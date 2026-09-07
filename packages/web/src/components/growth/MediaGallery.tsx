import { useCallback, useEffect, useState } from 'react';
import type { MediaItem } from '@bloommate/shared';
import { useMediaItems, mediaThumbUrl, mediaOriginalUrl } from '../../hooks/useMedia';
import { EmptyState } from '../shared/EmptyState';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Thumb({ item, className, onClick }: { item: MediaItem; className?: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed || item.thumbnailUnavailable) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-2xl ${className ?? ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        {item.kind === 'video' ? '🎬' : '🖼️'}
      </div>
    );
  }
  return (
    <img
      src={mediaThumbUrl(item.path)}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    />
  );
}

function Viewer({ items, index, onClose, onNavigate }: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (event.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, items.length, onClose, onNavigate]);

  if (!item) return null;
  const heicLike = item.kind === 'image' && item.thumbnailUnavailable;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span>
          {index + 1} / {items.length} · {item.name} · {formatSize(item.sizeBytes)}
        </span>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-white/70 hover:bg-white/10" aria-label="关闭">
          &times;
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {index > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(index - 1)}
            className="absolute left-2 z-10 rounded-full bg-white/10 px-3 py-2 text-2xl text-white/80 hover:bg-white/20"
            aria-label="上一张"
          >
            ‹
          </button>
        )}
        {item.kind === 'video' ? (
          <video
            key={item.path}
            src={mediaOriginalUrl(item.path)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full"
          />
        ) : heicLike ? (
          <div className="text-center text-white/70">
            <span className="block text-5xl">🖼️</span>
            <p className="mt-3 text-sm">此照片是 HEIC 格式，浏览器无法直接预览</p>
            <p className="mt-1 text-xs text-white/40">可在 iPhone 设置 → 相机 → 格式中选择"兼容性最佳"避免此问题</p>
          </div>
        ) : (
          <img key={item.path} src={mediaOriginalUrl(item.path)} alt={item.name} className="max-h-full max-w-full object-contain" />
        )}
        {index < items.length - 1 && (
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            className="absolute right-2 z-10 rounded-full bg-white/10 px-3 py-2 text-2xl text-white/80 hover:bg-white/20"
            aria-label="下一张"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

export function MediaGallery({ directory, title, onClose }: { directory: string; title?: string; onClose: () => void }) {
  const { data: items, isLoading } = useMediaItems(directory);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  return (
    <div role="dialog" aria-modal="true" aria-label={title ?? '照片'} className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">{title ?? '照片'}</h2>
            <p className="truncate text-xs text-slate-400">{directory} · {items?.length ?? 0} 项</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600" aria-label="关闭">&times;</button>
        </div>
        <div className="overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">加载中...</div>
          ) : !items || items.length === 0 ? (
            <EmptyState icon="📷" message="这个目录里暂时没有照片或视频" />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {items.map((item, i) => (
                <div key={item.path} className="relative">
                  <Thumb
                    item={item}
                    className="aspect-square w-full cursor-pointer rounded-lg"
                    onClick={() => setViewerIndex(i)}
                  />
                  {item.kind === 'video' && (
                    <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/50 px-1 text-xs text-white">🎬</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {viewerIndex !== null && items && (
        <Viewer items={items} index={viewerIndex} onClose={closeViewer} onNavigate={setViewerIndex} />
      )}
    </div>
  );
}

export function MediaCoverStrip({ directory, onOpen }: { directory: string; onOpen: () => void }) {
  const { data: items } = useMediaItems(directory);
  const covers = (items ?? []).slice(0, 4);
  if (covers.length === 0) return null;
  const total = items?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 flex w-full items-center gap-1 rounded-lg bg-slate-50 p-1 text-left transition-colors hover:bg-slate-100"
      aria-label={`查看 ${total} 张照片`}
    >
      <div className="flex flex-1 gap-1 overflow-hidden">
        {covers.map((item) => (
          <Thumb key={item.path} item={item} className="h-14 w-14 shrink-0 rounded-md" />
        ))}
      </div>
      <span className="shrink-0 px-2 text-xs text-slate-500">📷 {total} 项 ›</span>
    </button>
  );
}
