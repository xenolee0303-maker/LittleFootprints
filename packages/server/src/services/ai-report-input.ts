import type { AnalysisSnapshot } from '@bloommate/shared';

export interface AiReportInput {
  childId: string;
  childLabel: string;
  range: AnalysisSnapshot['range'];
  metrics: AnalysisSnapshot['metrics'];
  growth?: AnalysisSnapshot['growth'];
  evidence: Array<{ id: string; label: string; value: string | number }>;
  dataCompleteness: number;
  confidence: AnalysisSnapshot['confidence'];
}

export function buildAiReportInput(snapshot: AnalysisSnapshot): AiReportInput {
  return {
    childId: snapshot.childId,
    childLabel: snapshot.childLabel,
    range: snapshot.range,
    metrics: snapshot.metrics,
    growth: snapshot.growth,
    evidence: snapshot.evidence.map(({ id, label, value }) => ({ id, label, value })),
    dataCompleteness: snapshot.dataCompleteness,
    confidence: snapshot.confidence,
  };
}
