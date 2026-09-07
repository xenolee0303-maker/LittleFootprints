import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MediaStatus, MediaDirectoryInfo, MediaItem } from '@bloommate/shared';

export function useMediaStatus() {
  return useQuery({
    queryKey: ['media-status'],
    queryFn: () => api.get<MediaStatus>('/media/status'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMediaDirectories(search?: string) {
  return useQuery({
    queryKey: ['media-directories', search ?? ''],
    queryFn: () =>
      api.get<MediaDirectoryInfo[]>(`/media/directories${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMediaItems(directory: string | null | undefined) {
  return useQuery({
    queryKey: ['media-items', directory],
    queryFn: () => api.get<MediaItem[]>(`/media/items?path=${encodeURIComponent(directory ?? '')}`),
    enabled: !!directory,
    staleTime: 2 * 60 * 1000,
  });
}

export function mediaThumbUrl(path: string): string {
  return `/api/media/thumb?path=${encodeURIComponent(path)}`;
}

export function mediaOriginalUrl(path: string): string {
  return `/api/media/original?path=${encodeURIComponent(path)}`;
}
