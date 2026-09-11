export type AiProviderMode = 'cloud' | 'local';
export type AiReportStatus = 'pending' | 'ready' | 'failed' | 'stale';
export type AiReportFailureStage = 'core_request' | 'core_parse' | 'format_repair' | 'core_validate';
export type AiReportFailureCode =
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_authentication'
  | 'provider_invalid_request'
  | 'input_too_large'
  | 'invalid_json'
  | 'invalid_schema'
  | 'invalid_evidence'
  | 'repair_failed'
  | 'provider_not_configured'
  | 'generation_failed';
export type AiConfidence = 'low' | 'medium' | 'high';
export type AiContextPage = 'growth';
export type AiContextModule = 'page' | 'interests' | 'growth-timeline' | 'profile';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AnalysisEvidence {
  id: string;
  label: string;
  value: string | number;
  sourceType: 'interest_note' | 'growth_event' | 'journal' | 'aggregate';
  sourceId?: string;
}

export interface GrowthSnapshotContext {
  background: string | null;
  schoolStage: string | null;
  birthDate: string | null;
  interests: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    description: string | null;
    noteCountInRange: number;
    recentFourWeekNoteCounts: number[];
  }>;
}

export interface AnalysisSnapshot {
  childId: string;
  childLabel: string;
  range: { currentStart: string; currentEnd: string; previousStart: string; previousEnd: string };
  metrics: Record<string, number | string | null>;
  growth?: GrowthSnapshotContext;
  evidence: AnalysisEvidence[];
  dataCompleteness: number;
  confidence: AiConfidence;
  generatedAt: string;
}

export interface AnalysisContextSnapshot {
  page: AiContextPage;
  module: AiContextModule;
  childId: string;
  childLabel: string;
  dateFrom?: string;
  dateTo?: string;
  filters: Record<string, string | number | boolean | null>;
  snapshot: AnalysisSnapshot;
  createdAt: string;
}

export interface AiObservation { title: string; text: string; evidenceIds: string[]; confidence: AiConfidence; }
export interface AiReportPayload { summary: string; observations: AiObservation[]; recommendations: Array<{ title: string; text: string; evidenceIds: string[] }>; childSummary: { title: string; text: string; goal: string }; }

export interface AiProviderConfig { id: string; provider: string; mode: AiProviderMode; model?: string; endpoint?: string; timeoutMs?: number; maxInputTokens?: number; maxOutputTokens?: number; apiKeyConfigured: boolean; enabled: boolean; createdAt: string; updatedAt: string; }
export interface CreateAiProviderConfigRequest { provider: string; mode: AiProviderMode; model?: string; endpoint?: string; timeoutMs?: number; maxInputTokens?: number; maxOutputTokens?: number; apiKey?: string; enabled?: boolean; }
export interface UpdateAiProviderConfigRequest { mode?: AiProviderMode; model?: string; endpoint?: string; timeoutMs?: number; maxInputTokens?: number; maxOutputTokens?: number; apiKey?: string; enabled?: boolean; }
export interface AiProviderConfigResponse { config: AiProviderConfig; }

export interface AiAnalysisReport { id: string; childId: string; weekStart: string; status: AiReportStatus; currentRevisionId?: string; dataUpdatedAt?: string; failureCode?: AiReportFailureCode | string; failureStage?: AiReportFailureStage; createdAt: string; updatedAt: string; }
export interface CreateAiAnalysisReportRequest { childId: string; weekStart: string; context: AnalysisContextSnapshot; }
export interface ListAiAnalysisReportsRequest { childId: string; weekStartFrom?: string; weekStartTo?: string; status?: AiReportStatus; }
export interface ListAiAnalysisReportsResponse { reports: AiAnalysisReport[]; }
export interface GetAiAnalysisReportResponse { report: AiAnalysisReport; payload?: AiReportPayload; }
export interface AiAnalysisReportResponse { report: AiAnalysisReport; payload?: AiReportPayload; }
export interface AiAnalysisReportRevision { id: string; reportId: string; revision: number; payload: AiReportPayload; snapshotJson?: string; parentReportJson?: string; childReportJson?: string; provider?: string; model?: string; promptVersion?: string; generatedAt?: string; createdAt: string; }

export type AiConversationMessage = { role: 'system' | 'user' | 'assistant'; content: string; createdAt?: string; };
export interface AiSavedConversation { id: string; childId?: string; title?: string; contextJson?: string; messages: AiConversationMessage[]; evidenceJson?: string; provider?: string; model?: string; savedAt?: string; createdAt?: string; updatedAt?: string; }
export interface SaveAiConversationRequest { childId?: string; title?: string; messages: AiConversationMessage[]; }
export interface AiConversationResponse { conversation: AiSavedConversation; }
