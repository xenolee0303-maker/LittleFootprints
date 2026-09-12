import { useMemo, useState } from 'react';
import type { VaccineRecord } from '@littlefootprints/shared';
import { useVaccines, useCreateVaccine, useUpdateVaccine, useAdministerVaccine, useDeleteVaccine, useGenerateVaccineTemplate } from '../../hooks/useGrowth';
import { useProfile } from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface VaccineFormState {
  name: string;
  dose: string;
  scheduledDate: string;
  administeredDate: string;
}

export function VaccineSection({ childId }: { childId: string }) {
  const { isParent } = usePerspective();
  const { data: vaccines } = useVaccines(childId);
  const { data: profile } = useProfile(childId);
  const createVaccine = useCreateVaccine(childId);
  const updateVaccine = useUpdateVaccine();
  const administer = useAdministerVaccine();
  const deleteVaccine = useDeleteVaccine();
  const generate = useGenerateVaccineTemplate();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VaccineRecord | null>(null);
  const [form, setForm] = useState<VaccineFormState>({ name: '', dose: '', scheduledDate: '', administeredDate: '' });

  const { due, done } = useMemo(() => {
    const all = vaccines ?? [];
    const key = today();
    return {
      due: all.filter((v) => !v.administeredDate && v.scheduledDate && v.scheduledDate <= key),
      upcoming: all.filter((v) => !v.administeredDate && (!v.scheduledDate || v.scheduledDate > key)),
      done: all.filter((v) => v.administeredDate),
    };
  }, [vaccines]);

  const openCreate = () => {
    setForm({ name: '', dose: '', scheduledDate: '', administeredDate: '' });
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: VaccineRecord) => {
    setForm({
      name: record.name,
      dose: record.dose,
      scheduledDate: record.scheduledDate ?? '',
      administeredDate: record.administeredDate ?? '',
    });
    setEditing(record);
    setFormOpen(true);
  };

  const submit = () => {
    const payload = {
      name: form.name,
      dose: form.dose,
      scheduledDate: form.scheduledDate || null,
      administeredDate: form.administeredDate || null,
    };
    if (editing) {
      updateVaccine.mutate({ id: editing.id, ...payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createVaccine.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

  const formValid = form.name.trim().length > 0 && form.dose.trim().length > 0;

  const renderRow = (record: VaccineRecord, state: 'due' | 'upcoming' | 'done') => (
    <li key={record.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${state === 'done' ? 'bg-emerald-500' : state === 'due' ? 'bg-rose-500' : 'bg-gray-300'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-800">
          {record.name} · {record.dose}
          {state === 'done' && <span className="ml-1.5 text-xs text-emerald-600">✓ {record.administeredDate}</span>}
          {state === 'due' && <span className="ml-1.5 text-xs text-rose-500">应种 {record.scheduledDate}（已到期待种）</span>}
          {state === 'upcoming' && record.scheduledDate && <span className="ml-1.5 text-xs text-gray-400">应种 {record.scheduledDate}</span>}
        </p>
        {record.note && <p className="truncate text-xs text-gray-400">{record.note}</p>}
      </div>
      {isParent && state !== 'done' && (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => administer.mutate({ id: record.id, date: today() })}
        >
          打勾已种
        </Button>
      )}
      {isParent && (
        <div className="flex shrink-0 flex-col">
          <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>修改</Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:bg-red-50"
            onClick={() => {
              if (window.confirm(`删除「${record.name} ${record.dose}」？`)) deleteVaccine.mutate(record.id);
            }}
          >
            删除
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <section className="space-y-3" aria-label="疫苗接种">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          疫苗接种
          {due.length > 0 && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600">{due.length} 剂到期待种</span>
          )}
        </h3>
        {isParent && (
          <div className="flex gap-2">
            {due.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                loading={administer.isPending}
                onClick={() => {
                  if (due.length === 1) {
                    administer.mutate({ id: due[0]!.id, date: today() });
                  }
                }}
              >
                全部打勾
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={openCreate}>+ 手动添加</Button>
          </div>
        )}
      </div>

      {!vaccines || vaccines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
          {isParent ? (
            <>
              <p>还没有疫苗记录。</p>
              {profile?.birthDate ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  loading={generate.isPending}
                  onClick={() => generate.mutate(childId, {
                    onSuccess: (result) => window.alert(`已按国家免疫规划生成 ${result.created} 条应种记录，请逐项核对日期并按实际接种打勾`),
                    onError: (error) => window.alert(error.message),
                  })}
                >
                  按国家免疫规划一键生成（需核对）
                </Button>
              ) : (
                <p className="mt-1">先在「档案」分区填写出生日期，即可一键生成应种计划</p>
              )}
            </>
          ) : (
            <p>还没有疫苗记录</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {due.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-rose-500">到期待种</p>
              <ul className="space-y-1">{due.map((record) => renderRow(record, 'due'))}</ul>
            </div>
          )}
          {vaccines.filter((v) => !v.administeredDate && (!v.scheduledDate || v.scheduledDate > today())).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400">待种</p>
              <ul className="space-y-1">
                {vaccines
                  .filter((v) => !v.administeredDate && (!v.scheduledDate || v.scheduledDate > today()))
                  .map((record) => renderRow(record, 'upcoming'))}
              </ul>
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-emerald-600">已接种（{done.length}）</p>
              <ul className="space-y-1">{done.map((record) => renderRow(record, 'done'))}</ul>
            </div>
          )}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? '修改疫苗记录' : '添加疫苗记录'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="疫苗名称" value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} placeholder="如 乙肝疫苗" />
            <Input label="剂次" value={form.dose} onChange={(event) => setForm((f) => ({ ...f, dose: event.target.value }))} placeholder="如 第1剂" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="应种日期" type="date" value={form.scheduledDate} onChange={(event) => setForm((f) => ({ ...f, scheduledDate: event.target.value }))} />
            <Input label="实际接种日期" type="date" value={form.administeredDate} onChange={(event) => setForm((f) => ({ ...f, administeredDate: event.target.value }))} />
          </div>
          {(createVaccine.isError || updateVaccine.isError) && <p className="text-xs text-red-500">保存失败，请重试</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button>
            <Button loading={createVaccine.isPending || updateVaccine.isPending} disabled={!formValid} onClick={submit}>保存</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
