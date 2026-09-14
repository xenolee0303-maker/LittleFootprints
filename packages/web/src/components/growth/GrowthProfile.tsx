import { useMemo, useState } from 'react';
import type { ChildProfile, GrowthMeasurement } from '@littlefootprints/shared';
import {
  useProfile,
  useSaveProfile,
  useMeasurements,
  useCreateMeasurement,
  useUpdateMeasurement,
  useDeleteMeasurement,
} from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';
import { useBazi } from '../../hooks/useGrowth';
import { BaziCard } from './BaziCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

function GrowthCurve({ measurements }: { measurements: GrowthMeasurement[] }) {
  const [metric, setMetric] = useState<'height' | 'weight' | 'head'>('height');

  const points = useMemo(() => {
    return measurements
      .map((m) => ({ date: m.date, value: metric === 'height' ? m.heightCm : metric === 'weight' ? m.weightKg : m.headCm }))
      .filter((p): p is { date: string; value: number } => p.value !== null && p.value !== undefined)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [measurements, metric]);

  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
        再记录一次{metric === 'height' ? '身高' : metric === 'weight' ? '体重' : '头围'}就能看到成长曲线啦
      </div>
    );
  }

  const width = 320;
  const height = 160;
  const padding = 34;
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;
  const x = (index: number) => padding + (index / (points.length - 1)) * (width - padding * 2);
  const y = (value: number) => padding + (1 - (value - minValue) / valueSpan) * (height - padding * 2);

  const unit = metric === 'height' ? 'cm' : metric === 'weight' ? 'kg' : 'cm';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">生长曲线</span>
        <div className="flex gap-1">
          {(['height', 'weight', 'head'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={`rounded-full px-3 py-1 text-xs ${
                metric === key ? 'bg-indigo-50 text-primary font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {key === 'height' ? '身高' : key === 'weight' ? '体重' : '头围'}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" />
        <text x={padding - 6} y={y(maxValue) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
          {maxValue}
        </text>
        <text x={padding - 6} y={y(minValue) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
          {minValue}
        </text>
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
        />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r="3" fill="#6366f1" />
        ))}
        <text x={padding} y={height - 6} fontSize="9" fill="#9ca3af">
          {points[0].date.slice(2)}
        </text>
        <text x={width - padding} y={height - 6} textAnchor="end" fontSize="9" fill="#9ca3af">
          {points[points.length - 1].date.slice(2)}
        </text>
      </svg>
      <p className="mt-1 text-right text-xs text-gray-400">单位：{unit}，共 {points.length} 次记录</p>
    </div>
  );
}

interface ProfileFormState {
  birthDate: string;
  birthTime: string;
  gender: string;
  bloodType: string;
  fatherHeightCm: string;
  motherHeightCm: string;
  schoolStage: string;
  personality: string;
  aiBackground: string;
}

function profileToForm(profile: ChildProfile | undefined): ProfileFormState {
  return {
    birthDate: profile?.birthDate ?? '',
    birthTime: profile?.birthTime ?? '',
    gender: profile?.gender ?? 'unspecified',
    bloodType: profile?.bloodType ?? '',
    fatherHeightCm: profile?.fatherHeightCm?.toString() ?? '',
    motherHeightCm: profile?.motherHeightCm?.toString() ?? '',
    schoolStage: profile?.schoolStage ?? '',
    personality: profile?.personality ?? '',
    aiBackground: profile?.aiBackground ?? '',
  };
}

interface MeasurementFormState {
  date: string;
  heightCm: string;
  weightKg: string;
  headCm: string;
  note: string;
}

export function GrowthProfile({ childId }: { childId: string }) {
  const { isParent } = usePerspective();
  const { data: profile } = useProfile(childId);
  const { data: measurements } = useMeasurements(childId);
  const saveProfile = useSaveProfile(childId);
  const createMeasurement = useCreateMeasurement(childId);
  const updateMeasurement = useUpdateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({ birthDate: '', birthTime: '', gender: 'unspecified', bloodType: '', fatherHeightCm: '', motherHeightCm: '', schoolStage: '', personality: '', aiBackground: '' });

  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<GrowthMeasurement | null>(null);
  const [measurementForm, setMeasurementForm] = useState<MeasurementFormState>({
    date: new Date().toISOString().slice(0, 10),
    heightCm: '',
    weightKg: '',
    headCm: '',
    note: '',
  });

  const openProfileEdit = () => {
    setProfileForm(profileToForm(profile));
    setProfileOpen(true);
  };

  const submitProfile = () => {
    saveProfile.mutate(
      {
        birthDate: profileForm.birthDate || null,
        birthTime: profileForm.birthTime || null,
        gender: profileForm.gender as ChildProfile['gender'],
        bloodType: (profileForm.bloodType || null) as ChildProfile['bloodType'],
        fatherHeightCm: profileForm.fatherHeightCm === '' ? null : Number(profileForm.fatherHeightCm),
        motherHeightCm: profileForm.motherHeightCm === '' ? null : Number(profileForm.motherHeightCm),
        schoolStage: profileForm.schoolStage || null,
        personality: profileForm.personality || null,
        aiBackground: profileForm.aiBackground || null,
      },
      { onSuccess: () => setProfileOpen(false) },
    );
  };

  const openMeasurementCreate = () => {
    setMeasurementForm({ date: new Date().toISOString().slice(0, 10), heightCm: '', weightKg: '', headCm: '', note: '' });
    setEditingMeasurement(null);
    setMeasurementOpen(true);
  };

  const openMeasurementEdit = (measurement: GrowthMeasurement) => {
    setMeasurementForm({
      date: measurement.date,
      heightCm: measurement.heightCm?.toString() ?? '',
      weightKg: measurement.weightKg?.toString() ?? '',
      headCm: measurement.headCm?.toString() ?? '',
      note: measurement.note ?? '',
    });
    setEditingMeasurement(measurement);
    setMeasurementOpen(true);
  };

  const submitMeasurement = () => {
    const payload = {
      date: measurementForm.date,
      heightCm: measurementForm.heightCm === '' ? null : Number(measurementForm.heightCm),
      weightKg: measurementForm.weightKg === '' ? null : Number(measurementForm.weightKg),
      headCm: measurementForm.headCm === '' ? null : Number(measurementForm.headCm),
      note: measurementForm.note || null,
    };
    if (editingMeasurement) {
      updateMeasurement.mutate({ id: editingMeasurement.id, ...payload }, { onSuccess: () => setMeasurementOpen(false) });
    } else {
      createMeasurement.mutate(payload, { onSuccess: () => setMeasurementOpen(false) });
    }
  };

  const measurementValid =
    /^\d{4}-\d{2}-\d{2}$/.test(measurementForm.date) &&
    (measurementForm.heightCm !== '' || measurementForm.weightKg !== '' || measurementForm.headCm !== '');

  const latestHeight = measurements?.find((m) => m.heightCm !== null)?.heightCm;
  const latestWeight = measurements?.find((m) => m.weightKg !== null)?.weightKg;
  const { data: bazi } = useBazi(childId);

  const genderLabel = profile?.gender === 'female' ? '女' : profile?.gender === 'male' ? '男' : null;
  const ageText = (() => {
    if (!profile?.birthDate) return null;
    const [y, m, d] = profile.birthDate.split('-').map(Number);
    const birth = new Date(y, m - 1, d);
    const now = new Date();
    let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
    if (now.getDate() < d) months -= 1;
    if (months < 0) return null;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem} 个月`;
    return rem > 0 ? `${years} 岁 ${rem} 个月` : `${years} 岁`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">成长档案</h2>
        {isParent && (
          <Button size="sm" variant="secondary" onClick={openProfileEdit}>
            ✏️ 编辑档案
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {bazi?.available && (
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">生肖 · {bazi.zodiac}</span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700">星座 · {bazi.xingZuo}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">农历 · {bazi.lunarDate}</span>
            {ageText && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">年龄 · {ageText}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-400">出生日期</p>
            <p className="text-gray-800">{profile?.birthDate ?? '—'}{profile?.birthTime ? ` ${profile.birthTime}` : ''}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">性别</p>
            <p className="text-gray-800">{genderLabel ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">血型</p>
            <p className="text-gray-800">{profile?.bloodType && profile.bloodType !== 'unknown' ? profile.bloodType : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">学校阶段</p>
            <p className="text-gray-800">{profile?.schoolStage ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">父亲身高</p>
            <p className="text-gray-800">{profile?.fatherHeightCm ? `${profile.fatherHeightCm} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">母亲身高</p>
            <p className="text-gray-800">{profile?.motherHeightCm ? `${profile.motherHeightCm} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">最新身高</p>
            <p className="text-gray-800">{latestHeight !== undefined ? `${latestHeight} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">最新体重</p>
            <p className="text-gray-800">{latestWeight !== undefined ? `${latestWeight} kg` : '—'}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400">性格观察</p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{profile?.personality ?? '—'}</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400">AI 基础信息</p>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">会发送给 AI 分析</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{profile?.aiBackground ?? '—'}</p>
        </div>
      </div>

      <BaziCard childId={childId} />

      <GrowthCurve measurements={measurements ?? []} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">身高体重记录</h3>
        {isParent && (
          <Button size="sm" variant="secondary" onClick={openMeasurementCreate}>
            + 记一笔
          </Button>
        )}
      </div>
      {!measurements || measurements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
          还没有记录
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">日期</th>
                <th className="px-3 py-2 text-right font-medium">身高</th>
                <th className="px-3 py-2 text-right font-medium">体重</th>
                <th className="px-3 py-2 text-right font-medium">头围</th>
                <th className="px-3 py-2 text-left font-medium">备注</th>
                {isParent && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {measurements.map((measurement) => (
                <tr key={measurement.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700">{measurement.date}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{measurement.heightCm ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{measurement.weightKg ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{measurement.headCm ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{measurement.note ?? ''}</td>
                  {isParent && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openMeasurementEdit(measurement)}>
                        修改
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm('删除这条记录？')) deleteMeasurement.mutate(measurement.id);
                        }}
                      >
                        删除
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="编辑成长档案">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="出生日期"
              type="date"
              value={profileForm.birthDate}
              onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))}
            />
            <Input
              label="出生时间"
              type="time"
              value={profileForm.birthTime}
              onChange={(e) => setProfileForm((f) => ({ ...f, birthTime: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">性别</span>
              <select
                value={profileForm.gender}
                onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="unspecified">不填写</option>
                <option value="female">女</option>
                <option value="male">男</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700">血型</span>
              <select
                value={profileForm.bloodType}
                onChange={(e) => setProfileForm((f) => ({ ...f, bloodType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">不填写</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
                <option value="unknown">未知</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="父亲身高 (cm)"
              type="number"
              step="0.1"
              value={profileForm.fatherHeightCm}
              onChange={(e) => setProfileForm((f) => ({ ...f, fatherHeightCm: e.target.value }))}
              placeholder="可选，供生长分析参考"
            />
            <Input
              label="母亲身高 (cm)"
              type="number"
              step="0.1"
              value={profileForm.motherHeightCm}
              onChange={(e) => setProfileForm((f) => ({ ...f, motherHeightCm: e.target.value }))}
              placeholder="可选，供生长分析参考"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="学校阶段"
              value={profileForm.schoolStage}
              onChange={(e) => setProfileForm((f) => ({ ...f, schoolStage: e.target.value }))}
              placeholder="如：小学二年级"
            />
          </div>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">性格观察</span>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-20"
              value={profileForm.personality}
              onChange={(e) => setProfileForm((f) => ({ ...f, personality: e.target.value }))}
              placeholder="对孩子性格的观察和理解"
            />
          </label>
          <label className="space-y-1 block">
            <span className="block text-sm font-medium text-gray-700">AI 基础信息</span>
            <textarea
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-20"
              value={profileForm.aiBackground}
              onChange={(e) => setProfileForm((f) => ({ ...f, aiBackground: e.target.value }))}
              placeholder="写给 AI 的背景说明，帮助分析更了解孩子"
            />
            <span className="block text-xs text-amber-600">⚠️ 此内容会随分析请求发送给 AI 分析服务（云端或本地）</span>
          </label>
          {saveProfile.isError && <p className="text-xs text-red-500">保存失败，请重试</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setProfileOpen(false)}>
              取消
            </Button>
            <Button loading={saveProfile.isPending} onClick={submitProfile}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={measurementOpen}
        onClose={() => setMeasurementOpen(false)}
        title={editingMeasurement ? '修改记录' : '新增身高体重记录'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="日期"
              type="date"
              value={measurementForm.date}
              onChange={(e) => setMeasurementForm((f) => ({ ...f, date: e.target.value }))}
            />
            <Input
              label="身高 (cm)"
              type="number"
              step="0.1"
              value={measurementForm.heightCm}
              onChange={(e) => setMeasurementForm((f) => ({ ...f, heightCm: e.target.value }))}
              placeholder="可选"
            />
            <Input
              label="体重 (kg)"
              type="number"
              step="0.1"
              value={measurementForm.weightKg}
              onChange={(e) => setMeasurementForm((f) => ({ ...f, weightKg: e.target.value }))}
              placeholder="可选"
            />
            <Input
              label="头围 (cm)"
              type="number"
              step="0.1"
              value={measurementForm.headCm}
              onChange={(e) => setMeasurementForm((f) => ({ ...f, headCm: e.target.value }))}
              placeholder="可选"
            />
          </div>
          <Input
            label="备注"
            value={measurementForm.note}
            onChange={(e) => setMeasurementForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="可选，如：学校体检"
          />
          {(createMeasurement.isError || updateMeasurement.isError) && (
            <p className="text-xs text-red-500">保存失败：身高、体重、头围至少填一项</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMeasurementOpen(false)}>
              取消
            </Button>
            <Button
              loading={createMeasurement.isPending || updateMeasurement.isPending}
              disabled={!measurementValid}
              onClick={submitMeasurement}
            >
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
