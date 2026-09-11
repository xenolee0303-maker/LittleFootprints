import type { AiContextModule, AiContextPage, AnalysisContextSnapshot } from '@littlefootprints/shared';
import { buildAnalysisSnapshot } from './ai-analysis-snapshot.js';
import { todayLocalDate, getWeekStartDate } from '@littlefootprints/shared';

export const AI_CONTEXT_REGISTRY: Readonly<Record<AiContextPage, readonly AiContextModule[]>> = Object.freeze({
  growth: ['page', 'interests', 'growth-timeline', 'profile'],
});

export interface CreateAnalysisContextInput {
  childId: string;
  page: AiContextPage;
  module: AiContextModule;
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, string | number | boolean | null>;
}

const pages = new Set<AiContextPage>(['growth']);
const modules = new Set<AiContextModule>(['page', 'interests', 'growth-timeline', 'profile']);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export async function createAnalysisContext(input: CreateAnalysisContextInput): Promise<AnalysisContextSnapshot> {
  if (!input || typeof input.childId !== 'string' || !input.childId.trim()) throw new Error('childId is required');
  if (!pages.has(input.page)) throw new Error('invalid context page');
  if (!modules.has(input.module) || !AI_CONTEXT_REGISTRY[input.page].includes(input.module)) throw new Error('incompatible context module');
  if (input.dateFrom && !validDate(input.dateFrom)) throw new Error('invalid dateFrom');
  if (input.dateTo && !validDate(input.dateTo)) throw new Error('invalid dateTo');
  if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) throw new Error('invalid date range');

  const weekStart = getWeekStartDate(input.dateFrom ?? todayLocalDate());
  const snapshot = await buildAnalysisSnapshot(input.childId, weekStart, { dateFrom: input.dateFrom, dateTo: input.dateTo });
  if (!snapshot) throw new Error('child not found');

  // Module scoping: interests → interest evidence; timeline → event evidence;
  // page → both; profile → background context only (no evidence rows).
  const evidenceByModule = {
    interests: snapshot.evidence.filter((e) => e.sourceType === 'interest_note'),
    'growth-timeline': snapshot.evidence.filter((e) => e.sourceType === 'growth_event'),
  };
  const scopedEvidence = input.module === 'page'
    ? snapshot.evidence
    : input.module === 'profile'
      ? []
      : input.module === 'growth-timeline'
        ? snapshot.evidence.filter((e) => e.sourceType === 'growth_event' || e.sourceType === 'journal')
        : evidenceByModule[input.module];

  const scoped = {
    ...snapshot,
    metrics: input.module === 'profile'
      ? { activeInterestCount: snapshot.metrics.activeInterestCount, totalInterestCount: snapshot.metrics.totalInterestCount }
      : snapshot.metrics,
    evidence: scopedEvidence,
  };

  const context: AnalysisContextSnapshot = {
    page: input.page,
    module: input.module,
    childId: snapshot.childId,
    childLabel: snapshot.childLabel,
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    filters: { ...(input.filters ?? {}) },
    snapshot: scoped,
    createdAt: new Date().toISOString(),
  };
  return deepFreeze(context);
}
