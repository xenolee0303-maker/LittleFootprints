import { useMemo, useState } from 'react';
import type { DailyJournal } from '@littlefootprints/shared';
import { JOURNAL_MOOD_LABELS, AUTHOR_ROLE_LABELS } from '@littlefootprints/shared';
import { useJournal, useCreateJournal, useUpdateJournal, useDeleteJournal, useUploadJournalAsset, useDeleteAsset } from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../shared/EmptyState';
import { AssetViewer, AssetThumb } from './AssetViewer';
import type { MediaAssetInfo } from '@littlefootprints/shared';

const MOODS = Object.keys(JOURNAL_MOOD_LABELS);

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function moodDot(mood: string | null): string {
  switch (mood) {
    case 'great': return '😄';
    case 'good': return '🙂';
    case 'normal': return '😐';
    case 'tired': return '😪';
    case 'sad': return '😢';
    default: return '📝';
  }
}

function groupByMonth(entries: DailyJournal[]): Array<{ month: string; entries: DailyJournal[] }> {
  const groups = new Map<string, DailyJournal[]>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const list = groups.get(month) ?? [];
    list.push(entry);
    groups.set(month, list);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, list]) => ({ month, entries: list }));
}

interface FormState {
  date: string;
  content: string;
  mood: string | null;
}

export function DailyJournalSection({ childId }: { childId: string }) {
  const { isParent, authorRole } = usePerspective();
  const { data: entries, isLoading } = useJournal(childId);
  const createJournal = useCreateJournal(childId);
  const updateJournal = useUpdateJournal();
  const deleteJournal = useDeleteJournal();
  const uploadAsset = useUploadJournalAsset();
  const deleteAsset = useDeleteAsset();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DailyJournal | null>(null);
  const [form, setForm] = useState<FormState>({ date: today(), content: '', mood: null });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingAssets, setViewingAssets] = useState<{ assets: MediaAssetInfo[]; index: number } | null>(null);

  const monthGroups = useMemo(() => groupByMonth(entries ?? []), [entries]);

  const openCreate = () => {
    setForm({ date: today(), content: '', mood: null });
    setEditing(null);
    setPendingFiles([]);
    setUploadError(null);
    setFormOpen(true);
  };

  const openEdit = (entry: DailyJournal) => {
    setForm({ date: entry.date, content: entry.content, mood: entry.mood });
    setEditing(entry);
    setPendingFiles([]);
    setUploadError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    setUploadError(null);
    try {
      const saved = editing
        ? await updateJournal.mutateAsync({ id: editing.id, date: form.date, content: form.content, mood: form.mood })
        : await createJournal.mutateAsync({ date: form.date, content: form.content, mood: form.mood, authorRole });
      for (const file of pendingFiles) {
        await uploadAsset.mutateAsync({ entryId: saved.id, file });
      }
      setFormOpen(false);
      setPendingFiles([]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '保存或上传失败，请重试');
    }
  };

  const formValid = form.content.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date);
  const busy = createJournal.isPending || updateJournal.isPending || uploadAsset.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">每日日志</h2>
        <Button size="sm" onClick={openCreate}>
          {isParent ? '+ 写一篇' : '✏️ 写今天的'}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          icon="📔"
          message={isParent ? '还没有日志。每天一句话、一张照片，坚持下来就是最珍贵的成长故事' : '写下今天发生的事，以后翻起来会很有意思'}
        />
      ) : (
        <div className="space-y-5">
          {monthGroups.map(({ month, entries: list }) => (
            <div key={month} className="space-y-2">
              <p className="text-xs font-medium text-gray-400">{month.replace('-', ' 年 ')} 月 · {list.length} 篇</p>
              <div className="space-y-2">
                {list.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="text-lg leading-none">{moodDot(entry.mood)}</span>
                          <span>{entry.date}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">
                            {entry.authorRole === 'child' ? '🧒' : '👨‍👩‍👧'} {AUTHOR_ROLE_LABELS[entry.authorRole] ?? entry.authorRole}
                          </span>
                          {entry.mood && <span>{JOURNAL_MOOD_LABELS[entry.mood]}</span>}
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-700">{entry.content}</p>
                        {entry.assets && entry.assets.length > 0 && (
                          <div className="mt-2 grid w-44 grid-cols-4 gap-1">
                            {entry.assets.map((asset, ai) => (
                              <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: entry.assets!, index: ai })} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                          修改
                        </Button>
                        {isParent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => {
                              if (window.confirm('删除这篇日志（含附件）？')) deleteJournal.mutate(entry.id);
                            }}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? '修改日志' : '写日志'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">日期</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">今天的心情</span>
              <select
                value={form.mood ?? ''}
                onChange={(event) => setForm((f) => ({ ...f, mood: event.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">不记录</option>
                {MOODS.map((mood) => (
                  <option key={mood} value={mood}>{JOURNAL_MOOD_LABELS[mood]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">内容</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-28"
              value={form.content}
              onChange={(event) => setForm((f) => ({ ...f, content: event.target.value }))}
              placeholder={isParent ? '今天发生了什么值得记下来的事？' : '今天我……'}
            />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">照片/视频（可选）</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setPendingFiles((current) => [...current, ...files].slice(0, 9));
                event.target.value = '';
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-indigo-100"
              aria-label="添加照片或视频"
            />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file, i) => (
                  <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                    {file.type.startsWith('video') ? '🎬' : '🖼️'} {file.name.length > 14 ? `${file.name.slice(0, 12)}…` : file.name}
                    <button type="button" onClick={() => setPendingFiles((current) => current.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" aria-label={`移除 ${file.name}`}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            {editing?.assets && editing.assets.length > 0 && (
              <div className="grid w-44 grid-cols-4 gap-1">
                {editing.assets.map((asset, ai) => (
                  <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: editing.assets!, index: ai })} />
                ))}
              </div>
            )}
          </div>
          {(createJournal.isError || updateJournal.isError) && (
            <p className="text-xs text-red-500">保存失败，请重试</p>
          )}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button loading={busy} disabled={!formValid} onClick={() => void submit()}>保存</Button>
          </div>
        </div>
      </Modal>

      {viewingAssets && (
        <AssetViewer
          assets={viewingAssets.assets}
          index={viewingAssets.index}
          onClose={() => setViewingAssets(null)}
          onNavigate={(next) => setViewingAssets((current) => (current ? { ...current, index: next } : current))}
        />
      )}
    </div>
  );
}
