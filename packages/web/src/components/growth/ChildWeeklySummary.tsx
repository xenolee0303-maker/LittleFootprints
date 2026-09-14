import { useState } from 'react';
import type { ChildWeeklySummary } from '@littlefootprints/shared';
import { useChildSummaries } from '../../hooks/useGrowth';
import { usePerspective } from '../../lib/perspective';

function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  return y === new Date().getFullYear() ? `${m}月${d}日那一周` : `${y}年${m}月${d}日那一周`;
}

function SummaryCard({ summary, highlighted }: { summary: ChildWeeklySummary; highlighted?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlighted ? 'bg-gradient-to-br from-indigo-50 to-white border border-indigo-100' : 'bg-white border border-gray-100'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{weekLabel(summary.weekStart)}</span>
        {highlighted && <span className="text-xs">🌟</span>}
      </div>
      <h3 className="mt-1 font-semibold text-gray-900">{summary.childSummary.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{summary.childSummary.text}</p>
      {summary.childSummary.goal && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          🎯 本周小目标：{summary.childSummary.goal}
        </p>
      )}
    </div>
  );
}

export function ChildWeeklySummaryCard({ childId }: { childId: string }) {
  const { isParent } = usePerspective();
  const { data, isLoading } = useChildSummaries(childId);
  const [showHistory, setShowHistory] = useState(false);
  const summaries = data?.summaries ?? [];
  const latest = summaries[0];
  const history = summaries.slice(1);

  return (
    <section className="space-y-2" aria-label="上周亮点">
      <h2 className="text-base font-semibold text-gray-900">
        {isParent ? '孩子版周报亮点' : '🌟 我的上周亮点'}
      </h2>
      {!isParent && (
        <p className="text-xs text-gray-400">这里只写你的进步和亮点，是专门给你看的</p>
      )}
      {isLoading ? (
        <div className="py-6 text-center text-sm text-gray-400">加载中...</div>
      ) : !latest ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
          {isParent ? '还没有生成周报。配置 AI 服务后会自动生成；也可在下方「AI 联合周报」卡里手动生成。' : '这一周的亮点整理好之后就会出现在这里，先去记一笔兴趣进展吧'}
        </div>
      ) : (
        <div className="space-y-2">
          <SummaryCard summary={latest} highlighted />
          {history.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {showHistory ? '收起往期' : `查看往期（${history.length} 周）`}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {history.map((summary) => (
                    <SummaryCard key={summary.weekStart} summary={summary} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
