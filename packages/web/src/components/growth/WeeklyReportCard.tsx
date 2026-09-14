import { useMemo, useState } from 'react';
import type { AiAnalysisReport } from '@littlefootprints/shared';
import { useAiReports, useAiReport, useGenerateAiReport, useRefreshAiReport } from '../../hooks/useAiAnalysis';
import { useKidStudyStatus } from '../../hooks/useIntegration';
import { usePerspective } from '../../lib/perspective';
import { Button } from '../ui/Button';

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function WeeklyReportCard({ childId, childName }: { childId: string; childName: string }) {
  const { isParent } = usePerspective();
  const weekStart = useMemo(mondayOfCurrentWeek, []);
  const { data: reports, isLoading } = useAiReports(childId);
  const generate = useGenerateAiReport();
  const refresh = useRefreshAiReport();
  const { data: kidStudy } = useKidStudyStatus();

  const latest: AiAnalysisReport | undefined = useMemo(
    () => (reports ?? []).slice().sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0],
    [reports],
  );
  const { data: detail } = useAiReport(latest?.id, childId);
  const payload = detail?.payload ?? detail?.revision?.payload;
  const [open, setOpen] = useState(false);

  if (!isParent) {
    // Kids see their own highlights at the top of the page; the full report stays parent-only.
    return null;
  }

  const busy = generate.isPending || refresh.isPending;
  const errorText = (generate.error ?? refresh.error)?.message;

  return (
    <section className="rounded-xl border border-indigo-100 bg-white p-4 space-y-3" aria-label="AI 周报">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">📋 AI 联合周报</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            学习（kid-study）× 兴趣 × 日志 × 健康的综合分析
            {kidStudy?.configured ? ' · 已联动学习系统' : ' · 未联动学习系统'}
          </p>
        </div>
        <div className="flex gap-2">
          {!latest && (
            <Button size="sm" loading={generate.isPending} onClick={() => generate.mutate({ childId, weekStart })}>
              生成本周周报
            </Button>
          )}
          {latest && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
                {open ? '收起' : '查看全文'}
              </Button>
              <Button size="sm" loading={refresh.isPending} onClick={() => refresh.mutate({ id: latest.id, childId })}>
                {latest.status === 'stale' ? '已过期，刷新' : '用最新数据刷新'}
              </Button>
            </>
          )}
        </div>
      </div>

      {latest?.status === 'stale' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          记录有更新，这份周报基于旧数据——点「用最新数据刷新」重新生成。
        </p>
      )}
      {errorText && <p className="text-xs text-red-500" role="alert">{errorText}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-400">加载中...</p>
      ) : !latest ? (
        <p className="text-sm text-gray-400">
          还没有周报。配置 AI 服务（设置 → AI 服务提供方）后，可手动生成，之后每周日 20:00 自动生成。
        </p>
      ) : !payload ? (
        <p className="text-sm text-gray-400">周报内容缺失，请刷新。</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">统计周：{latest.weekStart} 起的一周{detail?.revision?.generatedAt ? ` · 生成于 ${detail.revision.generatedAt.slice(0, 16).replace('T', ' ')}` : ''}</p>
          <p className="text-sm leading-6 text-gray-800">{payload.summary}</p>
          {open && (
            <div className="space-y-3 pt-1">
              {payload.observations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">观察</p>
                  {payload.observations.map((observation, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-medium text-gray-800">{observation.title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-gray-600">{observation.text}</p>
                    </div>
                  ))}
                </div>
              )}
              {payload.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">建议</p>
                  {payload.recommendations.map((recommendation, i) => (
                    <div key={i} className="rounded-lg bg-indigo-50/60 p-3">
                      <p className="text-sm font-medium text-gray-800">{recommendation.title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-gray-600">{recommendation.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400">
                AI 分析基于记录数据与证据，仅供参考，不构成医疗或心理结论。
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-300">孩子名：{childName}</p>
    </section>
  );
}
