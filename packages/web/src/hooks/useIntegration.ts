import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  KidStudyBridgeStatus,
  KidStudyChildOption,
  ChildIntegration,
  LearningSummaryResponse,
} from '@littlefootprints/shared';

export function useKidStudyStatus() {
  return useQuery({
    queryKey: ['kidstudy-status'],
    queryFn: () => api.get<KidStudyBridgeStatus>('/integrations/kidstudy'),
  });
}

export function useSaveKidStudyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { baseUrl: string; pin?: string }) =>
      api.put<KidStudyBridgeStatus>('/integrations/kidstudy', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kidstudy-status'] }),
  });
}

export function useTestKidStudy() {
  return useMutation({
    mutationFn: () => api.post<{ ok: true; children: number }>('/integrations/kidstudy/test', {}),
  });
}

export function useKidStudyChildren(enabled: boolean) {
  return useQuery({
    queryKey: ['kidstudy-children'],
    queryFn: () => api.get<KidStudyChildOption[]>('/integrations/kidstudy/children'),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useChildIntegration(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-integration', childId],
    queryFn: () => api.get<ChildIntegration | null>(`/children/${childId}/integration`),
    enabled: !!childId,
  });
}

export function useSetChildIntegration(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kidstudyChildId: string; kidstudyChildName: string }) =>
      api.put<ChildIntegration>(`/children/${childId}/integration`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['child-integration', childId] }),
  });
}

export function useClearChildIntegration(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ success: boolean }>(`/children/${childId}/integration`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['child-integration', childId] }),
  });
}

export function useLearningSummary(childId: string | undefined) {
  return useQuery({
    queryKey: ['learning-summary', childId],
    queryFn: () => api.get<LearningSummaryResponse>(`/children/${childId}/learning/summary`),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
