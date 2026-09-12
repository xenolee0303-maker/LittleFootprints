import { useState } from 'react';
import type { HealthRecord, HealthRecordType } from '@littlefootprints/shared';
import { HEALTH_RECORD_TYPE_LABELS } from '@littlefootprints/shared';
import {
  useHealthProfile,
  useSaveHealthProfile,
  useHealthRecords,
  useCreateHealthRecord,
  useUpdateHealthRecord,
  useDeleteHealthRecord,
  useUploadHealthAsset,
  useDeleteAsset,
} from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../shared/EmptyState';
import { AssetViewer, AssetThumb } from './AssetViewer';
import { VaccineSection } from './VaccineSection';
import type { MediaAssetInfo } from '@littlefootprints/shared';

const RECORD_TYPES = Object.keys(HEALTH_RECORD_TYPE_LABELS) as HealthRecordType[];

const TYPE_BADGE_CLASSES: Record<string, string> = {
  checkup: 'bg-teal-100 text-teal-700',
  illness: 'bg-rose-100 text-rose-700',
  vaccination: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-600',
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RecordFormState {
  date: string;
  type: HealthRecordType;
  title: string;
  facility: string;
  summary: string;
  followUpDate: string;
}

export function HealthSection({ childId }: { childId: string }) {
  const { isParent } = usePerspective();
  const { data: profile } = useHealthProfile(childId);
  const { data: records, isLoading } = useHealthRecords(childId);
  const saveProfile = useSaveHealthProfile(childId);
  const createRecord = useCreateHealthRecord(childId);
  const updateRecord = useUpdateHealthRecord();
  const deleteRecord = useDeleteHealthRecord();
  const uploadAsset = useUploadHealthAsset();
  const deleteAsset = useDeleteAsset();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ allergies: '', chronicConditions: '', notes: '' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [form, setForm] = useState<RecordFormState>({ date: today(), type: 'checkup', title: '', facility: '', summary: '', followUpDate: '' });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingAssets, setViewingAssets] = useState<{ assets: MediaAssetInfo[]; index: number } | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | null>(null);

  const openProfileEdit = () => {
    setProfileForm({
      allergies: profile?.allergies ?? '',
      chronicConditions: profile?.chronicConditions ?? '',
      notes: profile?.notes ?? '',
    });
    setProfileOpen(true);
  };

  const submitProfile = () => {
    saveProfile.mutate(
      {
        allergies: profileForm.allergies || null,
        chronicConditions: profileForm.chronicConditions || null,
        notes: profileForm.notes || null,
      },
      { onSuccess: () => setProfileOpen(false) },
    );
  };

  const openCreate = () => {
    setForm({ date: today(), type: 'checkup', title: '', facility: '', summary: '', followUpDate: '' });
    setEditing(null);
    setPendingFiles([]);
    setUploadError(null);
    setFormOpen(true);
  };

  const openEdit = (record: HealthRecord) => {
    setForm({
      date: record.date,
      type: record.type,
      title: record.title,
      facility: record.facility ?? '',
      summary: record.summary ?? '',
      followUpDate: record.followUpDate ?? '',
    });
    setEditing(record);
    setPendingFiles([]);
    setUploadError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    setUploadError(null);
    try {
      const payload = {
        date: form.date,
        type: form.type,
        title: form.title,
        facility: form.facility || null,
        summary: form.summary || null,
        followUpDate: form.followUpDate || null,
      };
      const saved = editing
        ? await updateRecord.mutateAsync({ id: editing.id, ...payload })
        : await createRecord.mutateAsync(payload);
      let uploadFailed = 0;
      for (const file of pendingFiles) {
        try {
          await uploadAsset.mutateAsync({ recordId: saved.id, file });
        } catch {
          uploadFailed += 1;
        }
      }
      setFormOpen(false);
      setPendingFiles([]);
      if (uploadFailed > 0) {
        setSectionNotice(`记录已保存，但 ${uploadFailed} 个附件上传失败——打开该记录的「修改」可重新上传`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '保存或上传失败，请重试');
    }
  };

  const formValid = form.title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date);
  const hasHealthInfo = profile?.allergies || profile?.chronicConditions || profile?.notes;

  return (
    <div className="space-y-4">
      {sectionNotice && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{sectionNotice}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">身体状况</h2>
        {isParent && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={openProfileEdit}>✏️ 基础信息</Button>
            <Button size="sm" onClick={openCreate}>+ 记一笔就诊</Button>
          </div>
        )}
      </div>

      <section
        className={`rounded-xl border p-4 ${hasHealthInfo ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}
        aria-label="身体基础信息"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">身体基础信息</h3>
          {hasHealthInfo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">供 AI 参考（不做诊断）</span>}
        </div>
        {hasHealthInfo ? (
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-400">过敏源</p>
              <p className="text-gray-800">{profile?.allergies ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">基础疾病</p>
              <p className="font-medium text-gray-900">{profile?.chronicConditions ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">其他情况</p>
              <p className="text-gray-800">{profile?.notes ?? '—'}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            {isParent ? '还没有填写。过敏源、哮喘等基础情况会帮助 AI 更准确地分析活动与身体的关系' : '还没有填写'}
          </p>
        )}
      </section>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">就诊与检查记录</h3>
        <span className="text-xs text-gray-400">{records?.length ?? 0} 条</span>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
      ) : !records || records.length === 0 ? (
        <EmptyState icon="🩺" message={isParent ? '记录体检、生病就诊和疫苗接种，报告单拍照上传保存' : '还没有就诊记录'} />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[record.type] ?? TYPE_BADGE_CLASSES.other}`}>
                      {HEALTH_RECORD_TYPE_LABELS[record.type] ?? record.type}
                    </span>
                    <span className="text-sm text-gray-500">{record.date}</span>
                    {record.followUpDate && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-primary">复查 {record.followUpDate}</span>
                    )}
                  </div>
                  <h4 className="mt-1 font-medium text-gray-900">{record.title}</h4>
                  {record.facility && <p className="text-sm text-gray-500">🏥 {record.facility}</p>}
                  {record.summary && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{record.summary}</p>}
                  {record.assets && record.assets.length > 0 && (
                    <div className="mt-2 grid w-44 grid-cols-4 gap-1">
                      {record.assets.map((asset, ai) => (
                        <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: record.assets!, index: ai })} />
                      ))}
                    </div>
                  )}
                </div>
                {isParent && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>修改</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm(`删除「${record.title}」（含上传的报告）？`)) deleteRecord.mutate(record.id);
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

      <VaccineSection childId={childId} />

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="身体基础信息">
        <div className="space-y-3">
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">过敏源</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-16"
              value={profileForm.allergies}
              onChange={(event) => setProfileForm((f) => ({ ...f, allergies: event.target.value }))}
              placeholder="如：尘螨、花生、青霉素"
            />
          </label>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">基础疾病</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-16"
              value={profileForm.chronicConditions}
              onChange={(event) => setProfileForm((f) => ({ ...f, chronicConditions: event.target.value }))}
              placeholder="如：哮喘、过敏性鼻炎"
            />
          </label>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">其他情况</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-16"
              value={profileForm.notes}
              onChange={(event) => setProfileForm((f) => ({ ...f, notes: event.target.value }))}
              placeholder="如：视力、体态等想让 AI 了解的情况"
            />
          </label>
          <p className="text-xs text-amber-600">⚠️ 这些信息会随分析请求发送给 AI 服务，仅用于理解孩子处境；AI 不会据此给出诊断</p>
          {saveProfile.isError && <p className="text-xs text-red-500">保存失败，请重试</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setProfileOpen(false)}>取消</Button>
            <Button loading={saveProfile.isPending} onClick={submitProfile}>保存</Button>
          </div>
        </div>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? '修改就诊记录' : '记一笔就诊'}>
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
              <span className="block text-sm font-medium text-gray-700">类型</span>
              <select
                value={form.type}
                onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as HealthRecordType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {RECORD_TYPES.map((type) => (
                  <option key={type} value={type}>{HEALTH_RECORD_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">标题</span>
            <input
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="如：幼儿园年度体检、哮喘复诊"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">医院/机构</span>
              <input
                value={form.facility}
                onChange={(event) => setForm((f) => ({ ...f, facility: event.target.value }))}
                placeholder="可选"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">下次复查</span>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(event) => setForm((f) => ({ ...f, followUpDate: event.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">过程与医嘱</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-24"
              value={form.summary}
              onChange={(event) => setForm((f) => ({ ...f, summary: event.target.value }))}
              placeholder="症状、检查过程、诊断、用药和医生的叮嘱"
            />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">检查结果（可选）</span>
            {editing && (editing.assets?.length ?? 0) === 0 && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">这条记录还没有已上传的附件</p>
            )}
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setPendingFiles((current) => [...current, ...files].slice(0, 9));
                event.target.value = '';
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-indigo-100"
              aria-label="上传检查报告"
            />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file, i) => (
                  <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                    {file.name.toLowerCase().endsWith('.pdf') ? '📄' : file.type.startsWith('video') ? '🎬' : '🖼️'} {file.name.length > 14 ? `${file.name.slice(0, 12)}…` : file.name}
                    <button type="button" onClick={() => setPendingFiles((current) => current.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" aria-label={`移除 ${file.name}`}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            {editing && (editing.assets?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-emerald-600">已上传 {editing.assets!.length} 个附件（点击可查看）</p>
                <div className="grid w-44 grid-cols-4 gap-1">
                  {(editing.assets ?? []).map((asset, ai) => (
                    <AssetThumb key={asset.id} asset={asset} onClick={() => setViewingAssets({ assets: editing.assets ?? [], index: ai })} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {(createRecord.isError || updateRecord.isError) && (
            <p className="text-xs text-red-500">保存失败，请重试</p>
          )}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button
              loading={createRecord.isPending || updateRecord.isPending || uploadAsset.isPending}
              disabled={!formValid}
              onClick={() => void submit()}
            >
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
    </div>
  );
}
