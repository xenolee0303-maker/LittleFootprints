import { useKidStudyStatus, useLearningSummary } from '../../hooks/useIntegration';

export function LearningOverviewCard({ childId }: { childId: string }) {
  const { data: status } = useKidStudyStatus();
  const { data: result, isLoading } = useLearningSummary(childId);

  if (!status?.configured) return null;
  if (isLoading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400" aria-label="本周学习">
        正在读取学习数据...
      </section>
    );
  }
  if (!result?.available || !result.summary) {
    return (
      <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-400" aria-label="本周学习">
        📚 学习系统联动：{result?.message ?? '暂无数据'}。可在设置里配置地址和 PIN、并关联孩子。
      </section>
    );
  }
  const summary = result.summary;
  const hours = Math.floor(summary.learningMinutes / 60);
  const minutes = summary.learningMinutes % 60;

  return (
    <section className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4" aria-label="本周学习">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">📚 本周学习</h2>
        <span className="text-xs text-slate-400">来自 kid-study · 只读</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white p-2">
          <p className="text-xl font-bold text-sky-600">{summary.completionRate}%</p>
          <p className="text-xs text-gray-500">完成率</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-xl font-bold text-sky-600">{hours > 0 ? `${hours}时${minutes}分` : `${minutes}分`}</p>
          <p className="text-xs text-gray-500">学习时长</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-xl font-bold text-amber-500">🌸 {summary.flowerNet}</p>
          <p className="text-xs text-gray-500">小红花净得</p>
        </div>
      </div>
      {summary.courses.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {summary.courses.map((course) => `${course.name} +${course.flowerEarned}`).join(' · ')}
        </p>
      )}
    </section>
  );
}
