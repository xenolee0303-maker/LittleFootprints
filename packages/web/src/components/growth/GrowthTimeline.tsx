import { useMemo, useState } from 'react';
import type { Child, GrowthEvent, GrowthEventType } from '@littlefootprints/shared';
import { GROWTH_EVENT_TYPE_LABELS } from '@littlefootprints/shared';
import { useGrowthEvents, useCreateGrowthEvent, useUpdateGrowthEvent, useDeleteGrowthEvent, useUploadEventAsset, useDeleteAsset } from '../../hooks/useGrowth';
import { AssetViewer, AssetThumb } from './AssetViewer';
import type { MediaAssetInfo } from '@littlefootprints/shared';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../shared/EmptyState';
import { MediaGallery, MediaCoverStrip } from './MediaGallery';
import { MediaDirectoryPicker } from './MediaDirectoryPicker';

const EVENT_TYPES = Object.keys(GROWTH_EVENT_TYPE_LABELS) as GrowthEventType[];

const TYPE_BADGE_CLASSES: Record<string, string> = {
  travel: 'bg-sky-100 text-sky-700',
  competition: 'bg-amber-100 text-amber-700',
  performance: 'bg-pink-100 text-pink-700',
  gathering: 'bg-teal-100 text-teal-700',
  milestone: 'bg-violet-100 text-violet-700',
  observation: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-600',
};

function formatDateRange(start: string, end: string | null): string {
  return end && end !== start ? `${start} ~ ${end}` : start;
}

interface EventFormState {
  type: GrowthEventType;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  participantChildIds: string[];
  mediaDirectory: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GrowthTimeline({ children, childId }: { children: Child[]; childId: string }) {
  const { isParent } = usePerspective();
  const { data: events, isLoading } = useGrowthEvents(childId);
  const createEvent = useCreateGrowthEvent();
  const updateEvent = useUpdateGrowthEvent();
  const deleteEvent = useDeleteGrowthEvent();

  const [editing, setEditing] = useState<GrowthEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [galleryEvent, setGalleryEvent] = useState<GrowthEvent | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | null>(null);
  const uploadAsset = useUploadEventAsset();
  const deleteAsset = useDeleteAsset();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingAssets, setViewingAssets] = useState<{ assets: MediaAssetInfo[]; index: number } | null>(null);

  const initialForm = useMemo<EventFormState>(
    () => ({
      type: 'travel',
      title: '',
      startDate: today(),
      endDate: '',
      location: '',
      description: '',
      participantChildIds: [childId],
      mediaDirectory: null,
    }),
    [childId],
  );
  const [form, setForm] = useState<EventFormState>(initialForm);

  const openCreate = () => {
    setForm(initialForm);
    setPendingFiles([]);
    setUploadError(null);
    setCreating(true);
  };

  const openEdit = (event: GrowthEvent) => {
    setForm({
      type: event.type,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate ?? '',
      location: event.location ?? '',
      description: event.description ?? '',
      participantChildIds: event.participantChildIds,
      mediaDirectory: event.mediaDirectory,
    });
    setPendingFiles([]);
    setUploadError(null);
    setEditing(event);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const submitForm = async () => {
    const payload = {
      type: form.type,
      title: form.title,
      startDate: form.startDate,
      endDate: form.endDate || null,
      location: form.location || null,
      description: form.description || null,
      participantChildIds: form.participantChildIds,
      mediaDirectory: form.mediaDirectory,
    };
    setUploadError(null);
    try {
      const saved = editing
        ? await updateEvent.mutateAsync({ id: editing.id, ...payload })
        : await createEvent.mutateAsync(payload);
      let uploadFailed = 0;
      for (const file of pendingFiles) {
        try {
          await uploadAsset.mutateAsync({ eventId: saved.id, file });
        } catch {
          uploadFailed += 1;
        }
      }
      closeForm();
      setPendingFiles([]);
      if (uploadFailed > 0) {
        setSectionNotice(`事件已保存，但 ${uploadFailed} 个附件上传失败——打开该事件的「修改」可重新上传`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '保存或上传失败，请重试');
    }
  };

  const formValid =
    form.title.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.startDate) &&
    (form.endDate === '' || form.endDate >= form.startDate) &&
    form.participantChildIds.length > 0;

  return (
    <div className="space-y-4">
      {sectionNotice && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{sectionNotice}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">成长时间线</h2>
        {isParent && (
          <Button size="sm" onClick={openCreate}>
            + 添加事件
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
      ) : !events || events.length === 0 ? (
        <EmptyState icon="🌱" message="还没有成长事件，记录第一次旅行、比赛或演出吧" />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[event.type] ?? TYPE_BADGE_CLASSES.other}`}
                    >
                      {GROWTH_EVENT_TYPE_LABELS[event.type] ?? event.type}
                    </span>
                    <span className="text-sm text-gray-500">{formatDateRange(event.startDate, event.endDate)}</span>
                  </div>
                  <h3 className="mt-1 font-medium text-gray-900">{event.title}</h3>
                  {event.location && <p className="text-sm text-gray-500">📍 {event.location}</p>}
                  {event.description && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{event.description}</p>}
                  {event.mediaDirectory && (
                    <MediaCoverStrip directory={event.mediaDirectory} onOpen={() => setGalleryEvent(event)} />
                  )}
                  {event.assets && event.assets.length > 0 && (
                    <div className="mt-2 grid w-48 grid-cols-4 gap-1">
                      {event.assets.map((asset, ai) => (
                        <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: event.assets!, index: ai })} />
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {event.participantChildIds
                      .map((id) => children.find((child) => child.id === id)?.name)
                      .filter(Boolean)
                      .join('、')}
                  </p>
                </div>
                {isParent && (
                  <div className="flex shrink-0 gap-1">
                    {event.assets && event.assets.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:bg-gray-100"
                        onClick={() => {
                          const last = event.assets![event.assets!.length - 1];
                          if (window.confirm(`删除附件「${last.fileName}」？`)) deleteAsset.mutate(last.id);
                        }}
                      >
                        删附件
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(event)}>
                      修改
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm(`删除「${event.title}」？`)) deleteEvent.mutate(event.id);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating || editing !== null} onClose={closeForm} title={editing ? '修改事件' : '添加成长事件'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">类型</span>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GrowthEventType }))}
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {GROWTH_EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="地点"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="可选"
            />
          </div>
          <Input
            label="标题"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="如：北京旅游、钢琴二级考试"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="开始日期"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <Input
              label="结束日期"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">描述</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-20"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="记录这次经历的故事、孩子的表现和感受"
            />
          </label>
          <div className="rounded-lg border border-gray-100 p-3">
            <MediaDirectoryPicker
              value={form.mediaDirectory}
              onChange={(directory) => setForm((f) => ({ ...f, mediaDirectory: directory }))}
            />
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">现场照片/视频（可选）</span>
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
              aria-label="添加现场照片或视频"
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
              <div className="grid w-48 grid-cols-4 gap-1">
                {editing.assets.map((asset, ai) => (
                  <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: editing.assets!, index: ai })} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">参加的孩子</span>
            <div className="flex gap-2">
              {children.map((child) => {
                const checked = form.participantChildIds.includes(child.id);
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        participantChildIds: checked
                          ? f.participantChildIds.filter((id) => id !== child.id)
                          : [...f.participantChildIds, child.id],
                      }))
                    }
                    className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                      checked
                        ? 'bg-indigo-50 border-primary text-primary'
                        : 'bg-white border-gray-300 text-gray-600'
                    }`}
                  >
                    {child.name}
                  </button>
                );
              })}
            </div>
          </div>
          {(createEvent.isError || updateEvent.isError) && (
            <p className="text-xs text-red-500">
              {(createEvent.error ?? updateEvent.error)?.message || '保存失败，请检查填写内容后重试'}
            </p>
          )}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeForm}>
              取消
            </Button>
            <Button loading={createEvent.isPending || updateEvent.isPending || uploadAsset.isPending} disabled={!formValid} onClick={() => void submitForm()}>
              保存
            </Button>
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

      {galleryEvent && galleryEvent.mediaDirectory && (
        <MediaGallery
          directory={galleryEvent.mediaDirectory}
          title={galleryEvent.title}
          onClose={() => setGalleryEvent(null)}
        />
      )}
    </div>
  );
}
