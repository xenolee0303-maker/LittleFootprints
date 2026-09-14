import { useBazi } from '../../hooks/useGrowth';

const ELEMENT_COLORS: Record<string, string> = {
  '金': 'bg-amber-400',
  '木': 'bg-emerald-500',
  '水': 'bg-sky-500',
  '火': 'bg-rose-500',
  '土': 'bg-yellow-600',
};

export function BaziCard({ childId }: { childId: string }) {
  const { data: bazi } = useBazi(childId);
  if (!bazi?.available) return null;
  const maxCount = Math.max(1, ...bazi.fiveElements.map((fe) => fe.count));

  return (
    <section className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 space-y-3" aria-label="生辰八字">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">生辰八字</h3>
        <span className="text-xs text-gray-400">传统命理历法 · 文化趣味参考</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {bazi.pillars.map((pillar) => (
          <div key={pillar.pillar} className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">{pillar.pillar}柱</p>
            <p className="text-lg font-semibold tracking-widest text-gray-900">{pillar.ganZhi}</p>
            <p className="text-[10px] text-gray-400">{pillar.wuXing} · {pillar.naYin}</p>
          </div>
        ))}
        {!bazi.timeKnown && (
          <div className="self-center text-xs text-gray-400">缺时辰（可到档案里补出生时间）</div>
        )}
      </div>

      {bazi.trueSolarTime && (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-500">
          ⏱ 已按出生地（{bazi.birthPlace}）做真太阳时修正：{bazi.trueSolarTime}
        </p>
      )}

      <div>
        <p className="mb-1 text-xs text-gray-500">
          五行分布：日主 {bazi.dayMaster}
        </p>
        <div className="space-y-1">
          {bazi.fiveElements.map((fe) => (
            <div key={fe.element} className="flex items-center gap-2">
              <span className="w-4 text-xs text-gray-600">{fe.element}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${ELEMENT_COLORS[fe.element] ?? 'bg-gray-400'}`} style={{ width: `${(fe.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-3 text-right text-xs text-gray-500">{fe.count}</span>
            </div>
          ))}
        </div>
      </div>
      {bazi.daYun.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-gray-500">大运（十年一步）{bazi.qiYun ? ` · ${bazi.qiYun}` : ''}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {bazi.daYun.map((dy) => (
              <div
                key={dy.startYear}
                className={`shrink-0 rounded-lg border px-2 py-1.5 text-center ${
                  dy.current ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'
                }`}
              >
                <p className="text-sm font-semibold tracking-widest text-gray-900">{dy.ganZhi || '起运前'}</p>
                <p className="text-[10px] text-gray-400">{dy.startAge}~{dy.endAge}岁</p>
                {dy.current && <p className="text-[10px] font-medium text-violet-600">当前</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] leading-4 text-gray-400">
        八字与五行由出生日期按传统历法推算，属于民俗文化内容，仅供参考与趣味记录，不构成科学结论，请勿据此决定孩子的培养方向。
      </p>
    </section>
  );
}
