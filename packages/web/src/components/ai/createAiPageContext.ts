import type { AiContextModule, AiContextPage, AnalysisContextSnapshot } from '@bloommate/shared';
export function createAiPageContext(input: { page: AiContextPage; module: AiContextModule; childId: string; childLabel: string; dateFrom?: string; dateTo?: string; filters?: Record<string, string | number | boolean | null>; metrics?: Record<string, number | string | null> }): AnalysisContextSnapshot {
  const dateFrom = input.dateFrom;
  const dateTo = input.dateTo;
  const start = dateFrom ?? new Date().toISOString().slice(0, 10); const end = dateTo ?? start;
  return { page: input.page, module: input.module, childId: input.childId, childLabel: input.childLabel, dateFrom, dateTo, filters: { ...(input.filters ?? {}) }, snapshot: { childId: input.childId, childLabel: input.childLabel, range: { currentStart: start, currentEnd: end, previousStart: start, previousEnd: end }, metrics: { ...(input.metrics ?? {}) }, evidence: [], dataCompleteness: 0, confidence: 'low', generatedAt: new Date().toISOString() }, createdAt: new Date().toISOString() };
}
