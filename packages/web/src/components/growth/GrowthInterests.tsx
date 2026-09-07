import { useState } from 'react';
import type { Interest, InterestCategory, InterestStatus, InterestNoteType, InterestNote } from '@bloommate/shared';
import {
  INTEREST_CATEGORY_LABELS,
  INTEREST_STATUS_LABELS,
  INTEREST_NOTE_TYPE_LABELS,
  AUTHOR_ROLE_LABELS,
} from '@bloommate/shared';
import {
  useInterests,
  useCreateInterest,
  useUpdateInterest,
  useDeleteInterest,
  useCreateInterestNote,
  useUpdateInterestNote,
  useDeleteInterestNote,
} from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../shared/EmptyState';

const CATEGORIES = Object.keys(INTEREST_CATEGORY_LABELS) as InterestCategory[];
const STATUSES = Object.keys(INTEREST_STATUS_LABELS) as InterestStatus[];
const NOTE_TYPES = Object.keys(INTEREST_NOTE_TYPE_LABELS) as InterestNoteType[];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  exploring: 'bg-sky-100 text-sky-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-gray-100 text-gray-500',
};

const STATUS_ORDER: Record<InterestStatus, number> = { active: 0, exploring: 1, paused: 2, ended: 3 };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weeklyNoteStats(notes: { date: string }[]): { thisWeek: number; lastFourWeeks: number } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day);
  const fourWeeksAgo = new Date(monday);
  fourWeeksAgo.setDate(monday.getDate() - 21);
  const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const mondayKey = toKey(monday);
  const cutoffKey = toKey(fourWeeksAgo);
  let thisWeek = 0;
  let lastFourWeeks = 0;
  for (const note of notes) {
    if (note.date >= mondayKey) thisWeek += 1;
    if (note.date >= cutoffKey) lastFourWeeks += 1;
  }
  return { thisWeek, lastFourWeeks };
}

interface InterestFormState {
  name: string;
  category: InterestCategory;
  status: InterestStatus;
  startedAt: string;
  endedAt: string;
  description: string;
}

interface NoteFormState {
  date: string;
  type: InterestNoteType;
  content: string;
}

export function GrowthInterests({ childId }: { childId: string }) {
  const { isParent, authorRole } = usePerspective();
  const { data: interests, isLoading } = useInterests(childId);
  const createInterest = useCreateInterest(childId);
  const updateInterest = useUpdateInterest(childId);
  const deleteInterest = useDeleteInterest(childId);
  const createNote = useCreateInterestNote();
  const updateNote = useUpdateInterestNote();
  const deleteNote = useDeleteInterestNote();

  const [interestFormOpen, setInterestFormOpen] = useState(false);
  const [editingInterest, setEditingInterest] = useState<Interest | null>(null);
  const [interestForm, setInterestForm] = useState<InterestFormState>({
    name: '',
    category: 'art',
    status: 'exploring',
    startedAt: today(),
    endedAt: '',
    description: '',
  });

  const [noteTarget, setNoteTarget] = useState<Interest | null>(null);
  const [editingNote, setEditingNote] = useState<InterestNote | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormState>({ date: today(), type: 'practice', content: '' });

  const sortedInterests = [...(interests ?? [])].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.startedAt < b.startedAt ? 1 : -1),
  );

  const openCreateInterest = () => {
    setInterestForm({ name: '', category: 'art', status: 'exploring', startedAt: today(), endedAt: '', description: '' });
    setEditingInterest(null);
    setInterestFormOpen(true);
  };

  const openEditInterest = (interest: Interest) => {
    setInterestForm({
      name: interest.name,
      category: interest.category,
      status: interest.status,
      startedAt: interest.startedAt,
      endedAt: interest.endedAt ?? '',
      description: interest.description ?? '',
    });
    setEditingInterest(interest);
    setInterestFormOpen(true);
  };

  const submitInterest = () => {
    const payload = {
      name: interestForm.name,
      category: interestForm.category,
      status: interestForm.status,
      startedAt: interestForm.startedAt,
      endedAt: interestForm.endedAt || null,
      description: interestForm.description || null,
    };
    if (editingInterest) {
      updateInterest.mutate({ id: editingInterest.id, ...payload }, { onSuccess: () => setInterestFormOpen(false) });
    } else {
      createInterest.mutate(payload, { onSuccess: () => setInterestFormOpen(false) });
    }
  };

  const openCreateNote = (interest: Interest) => {
    setNoteForm({ date: today(), type: 'practice', content: '' });
    setEditingNote(null);
    setNoteTarget(interest);
  };

  const openEditNote = (interest: Interest, note: InterestNote) => {
    setNoteForm({ date: note.date, type: note.type, content: note.content });
    setEditingNote(note);
    setNoteTarget(interest);
  };

  const submitNote = () => {
    if (!noteTarget) return;
    const payload = { date: noteForm.date, type: noteForm.type, content: noteForm.content, authorRole };
    if (editingNote) {
      updateNote.mutate({ id: editingNote.id, ...payload }, { onSuccess: () => setNoteTarget(null) });
    } else {
      createNote.mutate({ interestId: noteTarget.id, ...payload }, { onSuccess: () => setNoteTarget(null) });
    }
  };

  const interestFormValid =
    interestForm.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(interestForm.startedAt);
  const noteFormValid = noteForm.content.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(noteForm.date);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">兴趣爱好</h2>
        {isParent && (
          <Button size="sm" onClick={openCreateInterest}>
            + 添加兴趣
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
      ) : sortedInterests.length === 0 ? (
        <EmptyState icon="⭐" message="还没有记录兴趣，添加孩子正在探索或坚持的爱好吧" />
      ) : (
        <div className="space-y-3">
          {sortedInterests.map((interest) => (
            <details key={interest.id} className="group rounded-xl border border-gray-200 bg-white" open={interest.status === 'active' || interest.status === 'exploring'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-gray-900">{interest.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[interest.status] ?? STATUS_BADGE_CLASSES.ended}`}>
                      {INTEREST_STATUS_LABELS[interest.status] ?? interest.status}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {INTEREST_CATEGORY_LABELS[interest.category] ?? interest.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {interest.startedAt} 开始{interest.endedAt ? ` · ${interest.endedAt} 结束` : ''}
                    {interest.notes.length > 0 && ` · 共 ${interest.notes.length} 条进展`}
                  </p>
                  {interest.status !== 'ended' && interest.notes.length > 0 && (() => {
                    const stats = weeklyNoteStats(interest.notes);
                    return (
                      <p className="mt-1 flex gap-1.5 text-xs">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600">本周 {stats.thisWeek} 条</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">近4周 {stats.lastFourWeeks} 条</span>
                      </p>
                    );
                  })()}
                  {interest.description && <p className="mt-1 text-sm text-gray-600">{interest.description}</p>}
                </div>
                <span className="shrink-0 text-gray-300 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="border-t border-gray-100 p-4 space-y-3">
                {interest.notes.length === 0 ? (
                  <p className="text-sm text-gray-400">还没有进展记录</p>
                ) : (
                  <ul className="space-y-2">
                    {interest.notes.map((note) => (
                      <li key={note.id} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-white px-2 py-0.5 border border-gray-200">
                                {INTEREST_NOTE_TYPE_LABELS[note.type] ?? note.type}
                              </span>
                              <span>{note.date}</span>
                              <span>{note.authorRole === 'child' ? '🧒' : '👨‍👩‍👧'} {AUTHOR_ROLE_LABELS[note.authorRole] ?? note.authorRole}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditNote(interest, note)}>
                              修改
                            </Button>
                            {isParent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  if (window.confirm('删除这条进展记录？')) deleteNote.mutate(note.id);
                                }}
                              >
                                删除
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="secondary" size="sm" onClick={() => openCreateNote(interest)}>
                  ✏️ 记一笔进展
                </Button>
              </div>
              {isParent && (
                <div className="flex justify-end gap-1 border-t border-gray-100 px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditInterest(interest)}>
                    编辑兴趣
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => {
                      if (window.confirm(`删除兴趣「${interest.name}」及其全部进展记录？`)) deleteInterest.mutate(interest.id);
                    }}
                  >
                    删除
                  </Button>
                </div>
              )}
            </details>
          ))}
        </div>
      )}

      <Modal
        open={interestFormOpen}
        onClose={() => setInterestFormOpen(false)}
        title={editingInterest ? '编辑兴趣' : '添加兴趣'}
      >
        <div className="space-y-3">
          <Input
            label="名称"
            value={interestForm.name}
            onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="如：钢琴、围棋、游泳"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">类别</span>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={interestForm.category}
                onChange={(e) => setInterestForm((f) => ({ ...f, category: e.target.value as InterestCategory }))}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {INTEREST_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">状态</span>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={interestForm.status}
                onChange={(e) => setInterestForm((f) => ({ ...f, status: e.target.value as InterestStatus }))}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {INTEREST_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="开始日期"
              type="date"
              value={interestForm.startedAt}
              onChange={(e) => setInterestForm((f) => ({ ...f, startedAt: e.target.value }))}
            />
            <Input
              label="结束日期"
              type="date"
              value={interestForm.endedAt}
              onChange={(e) => setInterestForm((f) => ({ ...f, endedAt: e.target.value }))}
            />
          </div>
          <Input
            label="简介"
            value={interestForm.description}
            onChange={(e) => setInterestForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="可选"
          />
          {(createInterest.isError || updateInterest.isError) && (
            <p className="text-xs text-red-500">保存失败，请检查填写内容后重试</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setInterestFormOpen(false)}>
              取消
            </Button>
            <Button
              loading={createInterest.isPending || updateInterest.isPending}
              disabled={!interestFormValid}
              onClick={submitInterest}
            >
              保存
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={noteTarget !== null}
        onClose={() => setNoteTarget(null)}
        title={`${editingNote ? '修改' : '记录'}进展${noteTarget ? ` · ${noteTarget.name}` : ''}`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="日期"
              type="date"
              value={noteForm.date}
              onChange={(e) => setNoteForm((f) => ({ ...f, date: e.target.value }))}
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">类型</span>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={noteForm.type}
                onChange={(e) => setNoteForm((f) => ({ ...f, type: e.target.value as InterestNoteType }))}
              >
                {NOTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INTEREST_NOTE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">内容</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-24"
              value={noteForm.content}
              onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={isParent ? '练习情况、进步、作品或孩子的感受' : '今天我……'}
            />
          </label>
          {!isParent && (
            <p className="text-xs text-indigo-500">🧒 以孩子身份记录，会标注"孩子"录入</p>
          )}
          {(createNote.isError || updateNote.isError) && (
            <p className="text-xs text-red-500">保存失败，请检查填写内容后重试</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNoteTarget(null)}>
              取消
            </Button>
            <Button loading={createNote.isPending || updateNote.isPending} disabled={!noteFormValid} onClick={submitNote}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
