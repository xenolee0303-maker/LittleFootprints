import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import type { AiAnalysisReport, AiAnalysisReportRevision, AiReportFailureCode, AiReportFailureStage, AiReportPayload, AnalysisSnapshot, ChildWeeklySummary } from '@littlefootprints/shared';
import { getWeekStartDate } from '@littlefootprints/shared';
import { getComparisonWeeks } from './week-utils.js';
import { db } from '../db/index.js';
import { aiAnalysisReportTable, aiAnalysisReportRevisionTable } from '../db/schema/ai-analysis-report.js';
import { aiProviderConfigTable } from '../db/schema/ai-provider-config.js';
import { buildAnalysisSnapshot } from './ai-analysis-snapshot.js';
import { buildReportRepairPrompt, buildWeeklyReportPrompt, AI_PROMPT_VERSION } from './ai-prompts.js';
import { AiOutputError, parseAndRecoverProviderReport } from './ai-output.js';
import { buildAiReportInput } from './ai-report-input.js';
import { withTransientRetry } from './ai-reliability.js';
import { providerFor } from './ai-provider-config.js';
import type { AiChatResponse } from './ai-provider.js';
import type { AiProvider } from './ai-provider.js';
import { AiProviderError } from './ai-reliability.js';

export interface AiReportLogEvent {
  provider?: string;
  model?: string;
  stage: AiReportFailureStage | 'core_request';
  attempt: number;
  durationMs: number;
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  errorCategory?: string;
}
export interface ReportGenerationOptions { provider?: AiProvider; providerId?: string; now?: () => string; logger?: (event: AiReportLogEvent) => void; }
export interface GeneratedReport { report: AiAnalysisReport; revision: AiAnalysisReportRevision; snapshot: AnalysisSnapshot; }

export class AiReportGenerationError extends Error {
  constructor(
    readonly failureCode: AiReportFailureCode,
    readonly failureStage: AiReportFailureStage,
    message: string,
    options?: ErrorOptions,
  ) { super(message, options); this.name = 'AiReportGenerationError'; }
}

function timestamp(now?: () => string) { return (now ?? (() => new Date().toISOString()))(); }
function ensureWeekStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || getWeekStartDate(value) !== value) throw new Error('weekStart must be a Monday');
}
function exposeReport(row: typeof aiAnalysisReportTable.$inferSelect): AiAnalysisReport {
  return { id: row.id, childId: row.childId, weekStart: row.weekStart, status: row.status as AiAnalysisReport['status'], currentRevisionId: row.currentRevisionId ?? undefined, dataUpdatedAt: row.dataUpdatedAt ?? undefined, failureCode: row.failureCode ?? undefined, failureStage: row.failureStage ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
function exposeRevision(row: typeof aiAnalysisReportRevisionTable.$inferSelect): AiAnalysisReportRevision {
  const payload = JSON.parse(row.payloadJson) as AiReportPayload;
  return { id: row.id, reportId: row.reportId, revision: row.revision, payload, snapshotJson: row.snapshotJson ?? undefined, parentReportJson: row.parentReportJson ?? undefined, childReportJson: row.childReportJson ?? undefined, provider: row.provider ?? undefined, model: row.model ?? undefined, promptVersion: row.promptVersion ?? undefined, generatedAt: row.generatedAt ?? undefined, createdAt: row.createdAt };
}
async function getProvider(options: ReportGenerationOptions): Promise<AiProvider> {
  if (options.provider) return options.provider;
  if (options.providerId) return providerFor(options.providerId);
  const config = await db.select().from(aiProviderConfigTable).where(eq(aiProviderConfigTable.enabled, true)).get();
  if (!config) throw new AiReportGenerationError('provider_not_configured', 'core_request', 'AI provider is not configured');
  return providerFor(config.id);
}
function errorCategory(error: unknown): string {
  if (error instanceof AiProviderError) return error.code;
  if (error instanceof AiOutputError) return error.code;
  return 'generation_failed';
}
function safeTokenUsage(usage: AiChatResponse['usage']): AiChatResponse['usage'] | undefined {
  if (!usage) return undefined;
  const safe: NonNullable<AiChatResponse['usage']> = {};
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
    const value = usage[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}
function logEvent(options: ReportGenerationOptions, event: AiReportLogEvent): void {
  try { options.logger?.({ ...event }); } catch { /* logging must never affect report generation */ }
}
async function completeReport(provider: AiProvider, snapshot: AnalysisSnapshot, options: ReportGenerationOptions): Promise<{ payload: AiReportPayload; response: AiChatResponse; model?: string }> {
  const input = buildAiReportInput(snapshot);
  let attempt = 0;
  const completeAtStage = async (stage: AiReportFailureStage, messages: ReturnType<typeof buildWeeklyReportPrompt>, temperature: number): Promise<AiChatResponse> => withTransientRetry(async () => {
    attempt += 1;
    const started = Date.now();
    try {
      const response = await provider.complete({ messages, responseFormat: 'json_object', maxOutputTokens: 8000, temperature });
      logEvent(options, { provider: options.providerId ?? 'configured', model: response.model, stage, attempt, durationMs: Date.now() - started, tokenUsage: safeTokenUsage(response.usage) });
      return response;
    } catch (error) {
      logEvent(options, { provider: options.providerId ?? 'configured', stage, attempt, durationMs: Date.now() - started, errorCategory: errorCategory(error) });
      throw error;
    }
  });
  let response: AiChatResponse;
  try {
    response = await completeAtStage('core_request', buildWeeklyReportPrompt(input), 0.2);
  } catch (error) {
    if (error instanceof AiReportGenerationError) throw error;
    if (error instanceof AiProviderError) throw error;
    throw new AiReportGenerationError('provider_unavailable', 'core_request', 'AI provider request failed', { cause: error });
  }
  try {
    return { payload: parseAndRecoverProviderReport(response.text, snapshot), response, model: response.model };
  } catch (error) {
    if (!(error instanceof AiOutputError)) throw error;
    logEvent(options, { provider: options.providerId ?? 'configured', model: response.model, stage: error.code === 'invalid_json' ? 'core_parse' : 'core_validate', attempt, durationMs: 0, tokenUsage: safeTokenUsage(response.usage), errorCategory: error.code });
    try {
      const repaired = await completeAtStage('format_repair', buildReportRepairPrompt(input, response.text, error.code), 0);
      try {
        return { payload: parseAndRecoverProviderReport(repaired.text, snapshot), response: repaired, model: repaired.model ?? response.model };
      } catch (repairError) {
        logEvent(options, { provider: options.providerId ?? 'configured', model: repaired.model ?? response.model, stage: 'format_repair', attempt, durationMs: 0, tokenUsage: safeTokenUsage(repaired.usage), errorCategory: 'repair_failed' });
        throw new AiReportGenerationError('repair_failed', 'format_repair', `repair_failed: AI output repair failed (${errorCategory(repairError)})`, { cause: repairError });
      }
    } catch (repairError) {
      if (repairError instanceof AiReportGenerationError) throw repairError;
      if (repairError instanceof AiProviderError) throw new AiReportGenerationError(repairError.code, 'format_repair', 'AI repair request failed', { cause: repairError });
      throw new AiReportGenerationError('repair_failed', 'format_repair', 'repair_failed: AI repair request failed');
    }
  }
}

export async function generateWeeklyReport(childId: string, weekStart: string, options: ReportGenerationOptions = {}): Promise<GeneratedReport> {
  if (!childId.trim()) throw new Error('childId is required');
  ensureWeekStart(weekStart);
  const snapshot = await buildAnalysisSnapshot(childId, weekStart);
  if (!snapshot) throw new Error('child not found');
  const now = timestamp(options.now);
  let existing = await db.select().from(aiAnalysisReportTable).where(and(eq(aiAnalysisReportTable.childId, childId), eq(aiAnalysisReportTable.weekStart, weekStart))).get();
  if (!existing) {
    const inserted = await db.insert(aiAnalysisReportTable).values({ id: crypto.randomUUID(), childId, weekStart, status: 'pending', currentRevisionId: null, dataUpdatedAt: snapshot.generatedAt, failureCode: null, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
    existing = await db.select().from(aiAnalysisReportTable).where(and(eq(aiAnalysisReportTable.childId, childId), eq(aiAnalysisReportTable.weekStart, weekStart))).get();
  }
  if (!existing) throw new Error('unable to create report');
  const hasReadyRevision = Boolean(existing.currentRevisionId);
  if (!hasReadyRevision) await db.update(aiAnalysisReportTable).set({ status: 'pending', failureCode: null, failureStage: null, updatedAt: now }).where(and(eq(aiAnalysisReportTable.id, existing.id), isNull(aiAnalysisReportTable.currentRevisionId))).run();
  try {
    const provider = await getProvider(options);
    const generated = await completeReport(provider, snapshot, options);
    const revisionId = crypto.randomUUID();
    const reportId = existing.id;
    const providerLabel = options.providerId ?? 'configured';
    const result = db.transaction((tx) => {
      const revisionNumber = tx.select().from(aiAnalysisReportRevisionTable).where(eq(aiAnalysisReportRevisionTable.reportId, reportId)).all().reduce((max, row) => Math.max(max, row.revision), 0) + 1;
      tx.insert(aiAnalysisReportRevisionTable).values({ id: revisionId, reportId, revision: revisionNumber, payloadJson: JSON.stringify(generated.payload), snapshotJson: JSON.stringify(snapshot), parentReportJson: JSON.stringify(generated.payload), childReportJson: JSON.stringify(generated.payload.childSummary), provider: providerLabel, model: generated.model ?? null, promptVersion: AI_PROMPT_VERSION, generatedAt: snapshot.generatedAt, createdAt: now }).run();
      tx.update(aiAnalysisReportTable).set({ status: 'ready', currentRevisionId: revisionId, dataUpdatedAt: snapshot.generatedAt, failureCode: null, failureStage: null, updatedAt: now }).where(eq(aiAnalysisReportTable.id, reportId)).run();
      return { report: tx.select().from(aiAnalysisReportTable).where(eq(aiAnalysisReportTable.id, reportId)).get()!, revision: tx.select().from(aiAnalysisReportRevisionTable).where(eq(aiAnalysisReportRevisionTable.id, revisionId)).get()! };
    });
    return { report: exposeReport(result.report), revision: exposeRevision(result.revision), snapshot };
  } catch (error) {
    if (!hasReadyRevision) {
      const failure = failureMetadata(error);
      await db.update(aiAnalysisReportTable).set({ status: 'failed', failureCode: failure.code, failureStage: failure.stage, updatedAt: now }).where(and(eq(aiAnalysisReportTable.id, existing.id), eq(aiAnalysisReportTable.status, 'pending'), isNull(aiAnalysisReportTable.currentRevisionId))).run();
    }
    throw error;
  }
}
function failureMetadata(error: unknown): { code: AiReportFailureCode; stage: AiReportFailureStage } {
  if (error instanceof AiReportGenerationError) return { code: error.failureCode, stage: error.failureStage };
  if (error instanceof AiProviderError) return { code: error.code, stage: 'core_request' };
  if (error instanceof AiOutputError) return { code: error.code, stage: error.code === 'invalid_json' ? 'core_parse' : 'core_validate' };
  return { code: 'generation_failed', stage: 'core_request' };
}
export function getAiReportFailure(error: unknown): { failureCode: AiReportFailureCode; failureStage: AiReportFailureStage } | undefined {
  const metadata = failureMetadata(error);
  return error instanceof Error || error instanceof AiProviderError || error instanceof AiOutputError ? { failureCode: metadata.code, failureStage: metadata.stage } : undefined;
}

export async function listReports(input: { childId: string; weekStartFrom?: string; weekStartTo?: string; status?: string }): Promise<AiAnalysisReport[]> {
  const clauses = [eq(aiAnalysisReportTable.childId, input.childId)];
  if (input.weekStartFrom) clauses.push(gte(aiAnalysisReportTable.weekStart, input.weekStartFrom));
  if (input.weekStartTo) clauses.push(lte(aiAnalysisReportTable.weekStart, input.weekStartTo));
  if (input.status) clauses.push(eq(aiAnalysisReportTable.status, input.status));
  return (await db.select().from(aiAnalysisReportTable).where(and(...clauses)).all()).map(exposeReport);
}
export async function getReport(id: string): Promise<{ report: AiAnalysisReport; revision?: AiAnalysisReportRevision } | null> {
  const row = await db.select().from(aiAnalysisReportTable).where(eq(aiAnalysisReportTable.id, id)).get(); if (!row) return null;
  const revision = row.currentRevisionId ? await db.select().from(aiAnalysisReportRevisionTable).where(eq(aiAnalysisReportRevisionTable.id, row.currentRevisionId)).get() : undefined;
  return { report: exposeReport(row), revision: revision ? exposeRevision(revision) : undefined };
}
/** Child-safe weekly summaries: only the childSummary field of ready reports, newest first. */
export async function listChildSummaries(childId: string, limit: number): Promise<ChildWeeklySummary[]> {
  const reports = await db
    .select({ id: aiAnalysisReportTable.id, weekStart: aiAnalysisReportTable.weekStart, currentRevisionId: aiAnalysisReportTable.currentRevisionId })
    .from(aiAnalysisReportTable)
    .where(and(eq(aiAnalysisReportTable.childId, childId), eq(aiAnalysisReportTable.status, 'ready')))
    .all();
  const sorted = reports.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, limit);
  const summaries: ChildWeeklySummary[] = [];
  for (const report of sorted) {
    if (!report.currentRevisionId) continue;
    const revision = await db
      .select({ childReportJson: aiAnalysisReportRevisionTable.childReportJson, generatedAt: aiAnalysisReportRevisionTable.generatedAt })
      .from(aiAnalysisReportRevisionTable)
      .where(eq(aiAnalysisReportRevisionTable.id, report.currentRevisionId))
      .get();
    if (!revision?.childReportJson) continue;
    try {
      const childSummary = JSON.parse(revision.childReportJson) as ChildWeeklySummary['childSummary'];
      if (!childSummary || typeof childSummary.title !== 'string') continue;
      summaries.push({ weekStart: report.weekStart, childSummary, generatedAt: revision.generatedAt ?? null });
    } catch {
      continue;
    }
  }
  return summaries;
}

export async function refreshReport(id: string, options: ReportGenerationOptions = {}) { const current = await db.select().from(aiAnalysisReportTable).where(eq(aiAnalysisReportTable.id, id)).get(); if (!current) throw new Error('report not found'); return generateWeeklyReport(current.childId, current.weekStart, options); }
export async function markAiReportsStale(childId: string, affectedDateFrom: string, affectedDateTo: string): Promise<void> {
  const rows = await db.select().from(aiAnalysisReportTable).where(eq(aiAnalysisReportTable.childId, childId)).all();
  const overlaps = rows.filter(row => { const { current } = getComparisonWeeks(row.weekStart); return current.weekStart <= affectedDateTo && current.weekEnd >= affectedDateFrom; });
  for (const row of overlaps) if (row.status === 'ready') await db.update(aiAnalysisReportTable).set({ status: 'stale', updatedAt: new Date().toISOString() }).where(eq(aiAnalysisReportTable.id, row.id)).run();
}
