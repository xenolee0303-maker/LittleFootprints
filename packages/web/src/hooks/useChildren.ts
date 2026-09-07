import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Child, CreateChildInput, UpdateChildInput } from '@littlefootprints/shared';

export function useChildren() {
  return useQuery({
    queryKey: ['children'],
    queryFn: () => api.get<Child[]>('/children'),
  });
}

export function useChild(id: string) {
  return useQuery({
    queryKey: ['children', id],
    queryFn: () => api.get<Child>(`/children/${id}`),
    enabled: !!id,
  });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChildInput) => api.post<Child>('/children', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}

export function useUpdateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateChildInput) =>
      api.patch<Child>(`/children/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}

export function useDeleteChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/children/${id}`),
    onSuccess: (_result, deletedId) => {
      qc.setQueryData<Child[]>(['children'], (current) =>
        current?.filter((child) => child.id !== deletedId),
      );
      void qc.invalidateQueries({ queryKey: ['children'] });
    },
  });
}
