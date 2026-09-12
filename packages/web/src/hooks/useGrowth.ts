import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  VaccineRecord,
  HealthProfile,
  HealthRecord,
  DailyJournal,
  ChildWeeklySummary,
  ChildProfile,
  GrowthMeasurement,
  InterestWithNotes,
  InterestNote,
  GrowthEvent,
  UpsertChildProfileInput,
  CreateGrowthMeasurementInput,
  UpdateGrowthMeasurementInput,
  CreateInterestInput,
  UpdateInterestInput,
  CreateInterestNoteInput,
  UpdateInterestNoteInput,
  CreateGrowthEventInput,
  UpdateGrowthEventInput,
} from '@littlefootprints/shared';

// ── Child profile ────────────────────────────────────────

export function useProfile(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-profile', childId],
    queryFn: () => api.get<ChildProfile>(`/children/${childId}/profile`),
    enabled: !!childId,
  });
}

export function useSaveProfile(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertChildProfileInput) => api.put<ChildProfile>(`/children/${childId}/profile`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['child-profile', childId] }),
  });
}

// ── Measurements ─────────────────────────────────────────

export function useMeasurements(childId: string | undefined) {
  return useQuery({
    queryKey: ['measurements', childId],
    queryFn: () => api.get<GrowthMeasurement[]>(`/children/${childId}/measurements`),
    enabled: !!childId,
  });
}

export function useCreateMeasurement(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGrowthMeasurementInput) =>
      api.post<GrowthMeasurement>(`/children/${childId}/measurements`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['measurements', childId] }),
  });
}

export function useUpdateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateGrowthMeasurementInput) =>
      api.patch<GrowthMeasurement>(`/measurements/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/measurements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
}

// ── Interests ────────────────────────────────────────────

export function useInterests(childId: string | undefined) {
  return useQuery({
    queryKey: ['interests', childId],
    queryFn: () => api.get<InterestWithNotes[]>(`/children/${childId}/interests`),
    enabled: !!childId,
  });
}

export function useCreateInterest(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterestInput) =>
      api.post<InterestWithNotes>(`/children/${childId}/interests`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests', childId] }),
  });
}

export function useUpdateInterest(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateInterestInput) =>
      api.patch<InterestWithNotes>(`/interests/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests', childId] }),
  });
}

export function useDeleteInterest(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/interests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests', childId] }),
  });
}

// ── Interest notes ───────────────────────────────────────

export function useCreateInterestNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ interestId, ...input }: { interestId: string } & CreateInterestNoteInput) =>
      api.post<InterestNote>(`/interests/${interestId}/notes`, input),
    onSuccess: (_result, { interestId }) => {
      void qc.invalidateQueries({ queryKey: ['interests'] });
      void qc.invalidateQueries({ queryKey: ['interest-notes', interestId] });
    },
  });
}

export function useUpdateInterestNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateInterestNoteInput) =>
      api.patch<InterestNote>(`/interest-notes/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
}

export function useDeleteInterestNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/interest-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
}

// ── Growth events ────────────────────────────────────────

export function useGrowthEvents(childId: string | undefined) {
  return useQuery({
    queryKey: ['growth-events', childId],
    queryFn: () =>
      api.get<GrowthEvent[]>(`/growth-events${childId ? `?childId=${encodeURIComponent(childId)}` : ''}`),
  });
}

export function useCreateGrowthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGrowthEventInput) => api.post<GrowthEvent>('/growth-events', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['growth-events'] }),
  });
}

export function useUpdateGrowthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateGrowthEventInput) =>
      api.patch<GrowthEvent>(`/growth-events/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['growth-events'] }),
  });
}

export function useDeleteGrowthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/growth-events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['growth-events'] }),
  });
}

// ── Child-safe weekly summaries ──────────────────────────

export function useChildSummaries(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-summaries', childId],
    queryFn: () => api.get<{ summaries: ChildWeeklySummary[] }>(`/children/${childId}/child-summaries`),
    enabled: !!childId,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Interest note assets (uploaded works) ────────────────

export function useUploadAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, file }: { noteId: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/interest-notes/${encodeURIComponent(noteId)}/assets`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message ?? '上传失败');
      }
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/assets/${encodeURIComponent(id)}`),
    // Assets can belong to interest notes, events, journals or health records.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interests'] });
      void qc.invalidateQueries({ queryKey: ['growth-events'] });
      void qc.invalidateQueries({ queryKey: ['journal'] });
      void qc.invalidateQueries({ queryKey: ['health-records'] });
    },
  });
}

export function useUploadEventAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, file }: { eventId: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/growth-events/${encodeURIComponent(eventId)}/assets`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message ?? '上传失败');
      }
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['growth-events'] }),
  });
}

// ── Daily journal ────────────────────────────────────────

export function useJournal(childId: string | undefined) {
  return useQuery({
    queryKey: ['journal', childId],
    queryFn: () => api.get<DailyJournal[]>(`/children/${childId}/journal`),
    enabled: !!childId,
  });
}

export function useCreateJournal(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; content: string; mood?: string | null; authorRole: 'parent' | 'child' }) =>
      api.post<DailyJournal>(`/children/${childId}/journal`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', childId] }),
  });
}

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<{ date: string; content: string; mood?: string | null }>) =>
      api.patch<DailyJournal>(`/journal/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/journal/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useUploadJournalAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, file }: { entryId: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/journal/${encodeURIComponent(entryId)}/assets`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message ?? '上传失败');
      }
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

// ── Health ───────────────────────────────────────────────

export function useHealthProfile(childId: string | undefined) {
  return useQuery({
    queryKey: ['health-profile', childId],
    queryFn: () => api.get<HealthProfile>(`/children/${childId}/health/profile`),
    enabled: !!childId,
  });
}

export function useSaveHealthProfile(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ allergies: string | null; chronicConditions: string | null; notes: string | null }>) =>
      api.put<HealthProfile>(`/children/${childId}/health/profile`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-profile', childId] }),
  });
}

export function useHealthRecords(childId: string | undefined) {
  return useQuery({
    queryKey: ['health-records', childId],
    queryFn: () => api.get<HealthRecord[]>(`/children/${childId}/health/records`),
    enabled: !!childId,
  });
}

export function useCreateHealthRecord(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; type: string; title: string; facility?: string | null; summary?: string | null; followUpDate?: string | null }) =>
      api.post<HealthRecord>(`/children/${childId}/health/records`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-records', childId] }),
  });
}

export function useUpdateHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<{ date: string; type: string; title: string; facility?: string | null; summary?: string | null; followUpDate?: string | null }>) =>
      api.patch<HealthRecord>(`/health-records/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-records'] }),
  });
}

export function useDeleteHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/health-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-records'] }),
  });
}

export function useUploadHealthAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, file }: { recordId: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/health-records/${encodeURIComponent(recordId)}/assets`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message ?? '上传失败');
      }
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-records'] }),
  });
}

// ── Vaccines ─────────────────────────────────────────────

export function useVaccines(childId: string | undefined) {
  return useQuery({
    queryKey: ['vaccines', childId],
    queryFn: () => api.get<VaccineRecord[]>(`/children/${childId}/vaccines`),
    enabled: !!childId,
  });
}

export function useCreateVaccine(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; dose: string; scheduledDate?: string | null; administeredDate?: string | null; note?: string | null }) =>
      api.post<VaccineRecord>(`/children/${childId}/vaccines`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccines', childId] }),
  });
}

export function useUpdateVaccine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<{ name: string; dose: string; scheduledDate?: string | null; administeredDate?: string | null; note?: string | null }>) =>
      api.patch<VaccineRecord>(`/vaccines/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccines'] }),
  });
}

export function useAdministerVaccine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date?: string }) =>
      api.post<VaccineRecord>(`/vaccines/${id}/administer`, { date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccines'] }),
  });
}

export function useDeleteVaccine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/vaccines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccines'] }),
  });
}

export function useGenerateVaccineTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) =>
      api.post<{ created: number }>(`/children/${childId}/vaccines/generate`, {}),
    onSuccess: (_result, generatorChildId) => qc.invalidateQueries({ queryKey: ['vaccines', generatorChildId] }),
  });
}
