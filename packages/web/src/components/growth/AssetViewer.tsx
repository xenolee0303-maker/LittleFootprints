import { useEffect, useState } from 'react';
import type { MediaAssetInfo } from '@littlefootprints/shared';

export function assetUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}`;
}

export function assetThumbUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}/thumb`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AssetViewer({ assets, index, onClose, onNavigate }: {
  assets: MediaAssetInfo[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const asset = assets[index];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (event.key === 'ArrowRight' && index < assets.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, assets.length, onClose, onNavigate]);

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span>{index + 1} / {assets.length} · {asset.fileName} · {formatSize(asset.sizeBytes)}</span>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-white/70 hover:bg-white/10" aria-label="关闭">&times;</button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {index > 0 && (
          <button type="button" onClick={() => onNavigate(index - 1)} className="absolute left-2 z-10 rounded-full bg-white/10 px-3 py-2 text-2xl text-white/80 hover:bg-white/20" aria-label="上一个">‹</button>
        )}
        {asset.kind === 'video' ? (
          <video key={asset.id} src={assetUrl(asset.id)} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : asset.fileName.toLowerCase().endsWith('.pdf') ? (
          <div className="text-center text-white/70">
            <span className="block text-5xl">📄</span>
            <p className="mt-3 text-sm">{asset.fileName}</p>
            <a href={assetUrl(asset.id)} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
              新窗口打开 PDF
            </a>
          </div>
        ) : (
          <BrokenImagePanel asset={asset} />
        )}
        {index < assets.length - 1 && (
          <button type="button" onClick={() => onNavigate(index + 1)} className="absolute right-2 z-10 rounded-full bg-white/10 px-3 py-2 text-2xl text-white/80 hover:bg-white/20" aria-label="下一个">›</button>
        )}
      </div>
    </div>
  );
}

function BrokenImagePanel({ asset }: { asset: MediaAssetInfo }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        key={asset.id}
        src={assetUrl(asset.id)}
        alt={asset.fileName}
        onError={() => setBroken(true)}
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  return (
    <div className="text-center text-white/70">
      <span className="block text-5xl">🖼️</span>
      <p className="mt-3 text-sm">{asset.fileName}</p>
      <p className="mt-1 text-xs text-white/40">缩略图无法生成，可能文件已损坏</p>
      <a href={assetUrl(asset.id)} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
        尝试新窗口打开原文件
      </a>
    </div>
  );
}

export function AssetThumb({ asset, onClick }: { asset: MediaAssetInfo; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const placeholderIcon = asset.fileName.toLowerCase().endsWith('.pdf') ? '📄' : asset.kind === 'video' ? '🎬' : '🖼️';
  return (
    <div
      className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-slate-100"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {asset.thumbnailUnavailable || failed ? (
        <div className="flex h-full w-full items-center justify-center text-2xl">{placeholderIcon}</div>
      ) : (
        <img
          src={assetThumbUrl(asset.id)}
          alt={asset.fileName}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
      {asset.kind === 'video' && (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/50 px-1 text-xs text-white">🎬</span>
      )}
    </div>
  );
}
