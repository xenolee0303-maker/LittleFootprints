import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiAnalysisReport, AiReportPayload, AiAnalysisReportRevision, AiSavedConversation, SaveAiConversationRequest, AiProviderConfig, CreateAiProviderConfigRequest, UpdateAiProviderConfigRequest } from '@littlefootprints/shared';
import { api } from '../api/client';

export interface AiReportDetail { report: AiAnalysisReport; payload?: AiReportPayload; revision?: AiAnalysisReportRevision }

export function useAiReports(childId: string | undefined, weekStartFrom?: string, weekStartTo?: string) {
  return useQuery({
    queryKey: ['ai-reports', childId, weekStartFrom, weekStartTo],
    enabled: Boolean(childId),
    queryFn: async () => {
      const params = new URLSearchParams({ child_id: childId! });
      if (weekStartFrom) params.set('week_start_from', weekStartFrom);
      if (weekStartTo) params.set('week_start_to', weekStartTo);
      const result = await api.get<{ reports: AiAnalysisReport[] }>(`/ai/reports?${params}`);
      return result.reports;
    },
  });
}

export function useAiReport(id: string | undefined, childId: string | undefined) {
  return useQuery({
    queryKey: ['ai-report', id, childId],
    enabled: Boolean(id && childId),
    queryFn: async (): Promise<AiReportDetail> => {
      const result = await api.get<AiReportDetail & { revision?: AiAnalysisReportRevision }>(`/ai/reports/${encodeURIComponent(id!)}?child_id=${encodeURIComponent(childId!)}`);
      return { ...result, payload: result.payload ?? result.revision?.payload };
    },
  });
}

export function useGenerateAiReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, weekStart }: { childId: string; weekStart: string }) =>
      api.post<AiReportDetail & { revision?: AiAnalysisReportRevision }>('/ai/reports/generate', { childId, weekStart }),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-reports', input.childId] });
    },
  });
}

export function useRefreshAiReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, childId }: { id: string; childId: string }) =>
      api.post<AiReportDetail & { revision?: AiAnalysisReportRevision }>(`/ai/reports/${encodeURIComponent(id)}/refresh`, { childId }),
    onSuccess: (result, input) => {
      queryClient.setQueryData(['ai-report', input.id, input.childId], { ...result, payload: result.payload ?? result.revision?.payload });
      void queryClient.invalidateQueries({ queryKey: ['ai-reports', input.childId] });
    },
  });
}

export function useAiConversations(childId: string | undefined) {
  return useQuery({ queryKey: ['ai-conversations', childId], enabled: Boolean(childId), queryFn: async () => (await api.get<{ conversations: AiSavedConversation[] }>(`/ai/conversations?child_id=${encodeURIComponent(childId!)}`)).conversations });
}
export function useSaveAiConversation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, childId, input, title }: { id: string; childId: string; input?: SaveAiConversationRequest; title?: string }) => api.post<{ conversation: AiSavedConversation }>(`/ai/conversations/${encodeURIComponent(id)}/save`, { ...(input ?? { title }), childId }), onSuccess: (_r, input) => { void qc.invalidateQueries({ queryKey: ['ai-conversations', input.childId] }); } });
}
export function useCreateAiConversation() {
  return useMutation({ mutationFn: (input: { childId: string; context: unknown; title?: string }) => api.post<{ conversation: AiSavedConversation }>('/ai/conversations', input) });
}
export function useAskAiConversation() {
  return useMutation({ mutationFn: ({ id, childId, question }: { id: string; childId: string; question: string }) => api.post<{ answer: string; messages: Array<{ role: string; content: string }> }>(`/ai/conversations/${encodeURIComponent(id)}/messages`, { childId, question }) });
}
export function useAiProviders() {
  return useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => (await api.get<{ providers: AiProviderConfig[] }>('/ai/providers')).providers,
  });
}

export function useCreateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiProviderConfigRequest) => api.post<{ config: AiProviderConfig }>('/ai/providers', input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ai-providers'] }); },
  });
}

export function useUpdateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAiProviderConfigRequest }) => api.patch<{ config: AiProviderConfig }>(`/ai/providers/${encodeURIComponent(id)}`, input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ai-providers'] }); },
  });
}

export function useTestAiProvider() {
  return useMutation({ mutationFn: (id: string) => api.post<{ result: { ok: boolean; model?: string } }>(`/ai/providers/${encodeURIComponent(id)}/test`, {}) });
}

export function useDeleteAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/ai/providers/${encodeURIComponent(id)}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ai-providers'] }); },
  });
}



