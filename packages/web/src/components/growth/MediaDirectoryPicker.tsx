import { useState } from 'react';
import { useMediaStatus, useMediaDirectories } from '../../hooks/useMedia';

function formatCount(images: number, videos: number): string {
  const parts: string[] = [];
  if (images > 0) parts.push(`${images} 张照片`);
  if (videos > 0) parts.push(`${videos} 个视频`);
  return parts.join(' · ');
}

export function MediaDirectoryPicker({ value, onChange }: { value: string | null; onChange: (directory: string | null) => void }) {
  const { data: status } = useMediaStatus();
  const [search, setSearch] = useState('');
  const { data: directories, isLoading } = useMediaDirectories(search);

  if (status && !status.configured) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-400">
        相册功能还未配置：部署时在飞牛 `.env` 中设置 `MEDIA_HOST_PATH`（飞牛相册的存储目录）并重新创建容器后，这里就能选择活动目录。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">关联相册目录</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            取消关联
          </button>
        )}
      </div>
      {value && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-primary">📁 {value}</p>
      )}
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜索目录名，如：北京"
        aria-label="搜索相册目录"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {isLoading ? (
          <p className="py-3 text-center text-xs text-gray-400">加载目录...</p>
        ) : !directories || directories.length === 0 ? (
          <p className="py-3 text-center text-xs text-gray-400">
            没有找到目录。可以在飞牛相册里按活动建目录（建议目录名如「2026-08-北京旅游」）。
          </p>
        ) : (
          directories.map((directory) => (
            <button
              key={directory.path}
              type="button"
              onClick={() => onChange(directory.path)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                value === directory.path
                  ? 'border-primary bg-indigo-50 text-primary'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">📁 {directory.path}</span>
              <span className="shrink-0 text-xs text-gray-400">{formatCount(directory.imageCount, directory.videoCount)}</span>
            </button>
          ))
        )}
      </div>
      <p className="text-xs text-gray-400">绑定后，相册目录里以后新增的照片会自动出现在这条事件下。</p>
    </div>
  );
}
