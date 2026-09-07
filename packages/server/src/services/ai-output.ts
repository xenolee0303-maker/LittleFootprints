import type { AiConfidence, AiReportPayload, AnalysisContextSnapshot, AnalysisEvidence, AnalysisSnapshot } from '@littlefootprints/shared';

export const AI_REPORT_SCHEMA_VERSION = 'ai-report.v1';
export type AiOutputFailureCode = 'invalid_json' | 'invalid_schema' | 'invalid_evidence';
export class AiOutputError extends Error {
  constructor(public readonly code: AiOutputFailureCode, message: string, options?: ErrorOptions) { super(message, options); this.name = 'AiOutputError'; }
}
export interface VersionedAiReportPayload extends AiReportPayload { schemaVersion: typeof AI_REPORT_SCHEMA_VERSION; }

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) throw new AiOutputError('invalid_schema', `invalid ${label} fields`);
}
function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AiOutputError('invalid_schema', `invalid ${field}`);
  return value.trim();
}
function confidence(value: unknown): AiConfidence {
  if (value !== 'low' && value !== 'medium' && value !== 'high') throw new AiOutputError('invalid_schema', 'invalid confidence');
  return value;
}
function evidenceIds(value: unknown, evidence: Map<string, AnalysisEvidence>): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !id.startsWith('evidence:') || !evidence.has(id))) throw new AiOutputError('invalid_evidence', 'invalid evidence references');
  return [...new Set(value as string[])];
}
function numericTokens(text: string): string[] {
  const normalized = text.normalize('NFKC').replace(/[０-９＋－％．]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[−﹣－]/g, '-').replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x6f0))
    .replace(/٬/g, ',').replace(/٫/g, '.').replace(/[⁄∕]/g, '/').replace(/∶/g, ':');
  if (/[\p{Nd}]/u.test(normalized.replace(/[0-9]/g, ''))) throw new AiOutputError('invalid_evidence', 'unsupported numeric notation');
  const tokens: string[] = [];
  const continuation = /[A-Za-z0-9.,:%/+\-]|[\p{N}\p{Cf}]|[万亿千百]/u;
  for (let i = 0; i < normalized.length; i += 1) {
    const signed = /[+-]/.test(normalized[i] ?? '') && /[0-9]/.test(normalized[i + 1] ?? '');
    if ((!/[0-9]/.test(normalized[i] ?? '') && !signed) || (i > 0 && /[A-Za-z0-9]/.test(normalized[i - 1] ?? ''))) continue;
    let end = i + 1;
    if (signed) end = i + 2;
    while (end < normalized.length && continuation.test(normalized[end] ?? '')) {
      if (normalized[end] === ',' && !/[0-9]/.test(normalized[end + 1] ?? '')) break;
      end += 1;
    }
    if (end < normalized.length && normalized[end] === ' ' && /[0-9]/.test(normalized[end + 1] ?? '')) { while (end < normalized.length && (normalized[end] === ' ' || continuation.test(normalized[end] ?? ''))) end += 1; }
    const token = normalized.slice(i, end);
    const valid = /^(?:[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?)(?:%)?$/.test(token);
    if (!valid) throw new AiOutputError('invalid_evidence', `unsupported numeric notation: ${token}`);
    tokens.push(token);
    i = end - 1;
  }
  return tokens;
}
function normalizedNumber(value: string | number): string {
  const text = String(value).replace(/%$/, '').replace(/,/g, '');
  const number = Number(text);
  if (!Number.isFinite(number)) return 'NaN';
  return String(number);
}
function withoutKnownLabels(text: string, knownLabels: string[]): string {
  return knownLabels.reduce((result, label) => label ? result.replaceAll(label, '') : result, text);
}
function verifyNumbers(text: string, refs: string[], evidence: Map<string, AnalysisEvidence>, knownLabels: string[]): void {
  const values = refs.flatMap((id) => { const value = evidence.get(id)?.value; return value === undefined ? [] : [normalizedNumber(value)]; });
  for (const token of numericTokens(withoutKnownLabels(text, knownLabels))) if (!values.some((value) => value === normalizedNumber(token))) throw new AiOutputError('invalid_evidence', `number is not supported by evidence: ${token}`);
}
function validateObservation(value: unknown, evidence: Map<string, AnalysisEvidence>, knownLabels: string[]): AiReportPayload['observations'][number] {
  if (!isObject(value)) throw new AiOutputError('invalid_schema', 'invalid observation');
  exactKeys(value, ['title', 'text', 'evidenceIds', 'confidence'], 'observation');
  const title = requiredString(value.title, 'observation.title');
  const text = requiredString(value.text, 'observation.text');
  const refs = evidenceIds(value.evidenceIds, evidence);
  verifyNumbers(`${title} ${text}`, refs, evidence, knownLabels);
  return { title, text, evidenceIds: refs, confidence: confidence(value.confidence) };
}
function validateRecommendation(value: unknown, evidence: Map<string, AnalysisEvidence>, knownLabels: string[]): AiReportPayload['recommendations'][number] {
  if (!isObject(value)) throw new AiOutputError('invalid_schema', 'invalid recommendation');
  exactKeys(value, ['title', 'text', 'evidenceIds'], 'recommendation');
  const title = requiredString(value.title, 'recommendation.title');
  const text = requiredString(value.text, 'recommendation.text');
  const refs = evidenceIds(value.evidenceIds, evidence);
  verifyNumbers(`${title} ${text}`, refs, evidence, knownLabels);
  return { title, text, evidenceIds: refs };
}

export function validateAiReportPayload(value: unknown, snapshot: AnalysisSnapshot): VersionedAiReportPayload {
  if (!isObject(value) || value.schemaVersion !== AI_REPORT_SCHEMA_VERSION) throw new AiOutputError('invalid_schema', 'invalid AI report schema version');
  exactKeys(value, ['schemaVersion', 'childId', 'summary', 'observations', 'recommendations', 'childSummary'], 'AI report');
  if (value.childId !== undefined && value.childId !== snapshot.childId) throw new AiOutputError('invalid_schema', 'AI output child does not match context');
  const evidence = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const knownLabels = (snapshot.growth?.interests ?? []).map((interest) => interest.name).filter(Boolean);
  const summary = requiredString(value.summary, 'summary');
  if (!Array.isArray(value.observations) || !Array.isArray(value.recommendations)) throw new AiOutputError('invalid_schema', 'invalid AI report shape');
  if (!isObject(value.childSummary)) throw new AiOutputError('invalid_schema', 'invalid childSummary');
  exactKeys(value.childSummary, ['title', 'text', 'goal'], 'childSummary');
  const childSummary = { title: requiredString(value.childSummary.title, 'childSummary.title'), text: requiredString(value.childSummary.text, 'childSummary.text'), goal: requiredString(value.childSummary.goal, 'childSummary.goal') };
  return { schemaVersion: AI_REPORT_SCHEMA_VERSION, summary, observations: value.observations.map((item) => validateObservation(item, evidence, knownLabels)), recommendations: value.recommendations.map((item) => validateRecommendation(item, evidence, knownLabels)), childSummary };
}

export function parseAndValidateAiReport(raw: string, snapshot: AnalysisSnapshot): VersionedAiReportPayload {
  return validateAiReportPayload(parseAiReportJson(raw), snapshot);
}

function parseAiReportJson(raw: string): unknown {
  if (typeof raw !== 'string') throw new AiOutputError('invalid_json', 'AI output is not valid JSON');
  let parsed: unknown;
  try { parsed = JSON.parse(raw.trim()); } catch { parsed = extractSingleJsonObject(raw); }
  return parsed;
}

function projectProviderReport(value: unknown): unknown {
  if (!isObject(value)) return value;
  const projected: Record<string, unknown> = {
    schemaVersion: value.schemaVersion,
    summary: value.summary,
    observations: Array.isArray(value.observations) ? value.observations.map((item) => isObject(item) ? ({
      title: item.title,
      text: item.text,
      evidenceIds: item.evidenceIds,
      confidence: item.confidence,
    }) : item) : value.observations,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations.map((item) => isObject(item) ? ({
      title: item.title,
      text: item.text,
      evidenceIds: item.evidenceIds,
    }) : item) : value.recommendations,
    childSummary: isObject(value.childSummary) ? ({
      title: value.childSummary.title,
      text: value.childSummary.text,
      goal: value.childSummary.goal,
    }) : value.childSummary,
  };
  if (value.childId !== undefined) projected.childId = value.childId;
  return projected;
}

export function parseAndValidateProviderReport(raw: string, snapshot: AnalysisSnapshot): VersionedAiReportPayload {
  return validateAiReportPayload(projectProviderReport(parseAiReportJson(raw)), snapshot);
}

function retainsValidEvidenceItem(
  projected: Record<string, unknown>,
  snapshot: AnalysisSnapshot,
  field: 'observations' | 'recommendations',
  item: unknown,
): boolean {
  const candidate = {
    ...projected,
    observations: field === 'observations' ? [item] : [],
    recommendations: field === 'recommendations' ? [item] : [],
  };
  try {
    validateAiReportPayload(candidate, snapshot);
    return true;
  } catch (error) {
    if (error instanceof AiOutputError && error.code === 'invalid_evidence') return false;
    throw error;
  }
}

export function parseAndRecoverProviderReport(raw: string, snapshot: AnalysisSnapshot): VersionedAiReportPayload {
  const projected = projectProviderReport(parseAiReportJson(raw));
  try {
    return validateAiReportPayload(projected, snapshot);
  } catch (error) {
    if (!(error instanceof AiOutputError) || error.code !== 'invalid_evidence' || !isObject(projected)) throw error;
    if (!Array.isArray(projected.observations) || !Array.isArray(projected.recommendations)) throw error;
    return validateAiReportPayload({
      ...projected,
      observations: projected.observations.filter((item) => retainsValidEvidenceItem(projected, snapshot, 'observations', item)),
      recommendations: projected.recommendations.filter((item) => retainsValidEvidenceItem(projected, snapshot, 'recommendations', item)),
    }, snapshot);
  }
}

export function extractSingleJsonObject(raw: string): unknown {
  const candidates: Array<{ start: number; end: number; value?: unknown }> = [];
  let start = -1; let depth = 0; let arrayDepth = 0; let inString = false; let escaped = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; continue; }
    if (char === '[') { arrayDepth += 1; continue; }
    if (char === ']') { if (arrayDepth > 0) arrayDepth -= 1; continue; }
    if (char === '{') { if (depth === 0 && arrayDepth === 0) start = i; depth += 1; continue; }
    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = { start, end: i + 1 } as { start: number; end: number; value?: unknown };
        try { candidate.value = JSON.parse(raw.slice(start, i + 1)); } catch { /* retain malformed candidates so trailing objects cannot be ignored */ }
        candidates.push(candidate);
        start = -1;
      }
    }
  }
  if (depth !== 0 || arrayDepth !== 0 || candidates.length !== 1 || !isObject(candidates[0]?.value)) throw new AiOutputError('invalid_json', 'AI output must contain exactly one complete JSON object');
  const candidate = candidates[0]!;
  const wrapperText = (text: string): string => text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const allowedWrapper = (text: string): boolean => {
    const wrapper = wrapperText(text);
    if (!wrapper) return true;
    // Keep the existing brief explanatory-wrapper behavior, while rejecting
    // arbitrary/unstructured trailing output after the sole JSON object.
    return wrapper.length <= 160 && !/[{}\[\]"`]/u.test(wrapper) && /[.!?。！？：:]$/u.test(wrapper);
  };
  if (!allowedWrapper(raw.slice(0, candidate.start)) || !allowedWrapper(raw.slice(candidate.end))) throw new AiOutputError('invalid_json', 'AI output contains unsupported wrapper text');
  return candidate.value;
}

export function validateEvidenceReferences(ids: string[], snapshot: AnalysisSnapshot): string[] { return evidenceIds(ids, new Map(snapshot.evidence.map((item) => [item.id, item]))); }
export type AiOutputContext = AnalysisSnapshot | AnalysisContextSnapshot;
