import type { AiContextModule, AiContextPage, AnalysisContextSnapshot } from '@bloommate/shared';

const pageLabels: Record<AiContextPage, string> = { growth: '成长' };
const moduleLabels: Record<AiContextModule, string> = { page: '整页', interests: '兴趣', 'growth-timeline': '成长时间线', profile: '成长档案' };

export function AiContextBadge({ context, className = '' }: { context: Pick<AnalysisContextSnapshot, 'page' | 'module' | 'childLabel' | 'dateFrom' | 'dateTo' | 'filters'>; className?: string }) {
  const range = context.dateFrom && context.dateTo ? `${context.dateFrom} 至 ${context.dateTo}` : context.dateFrom ?? context.dateTo;
  const filterText = Object.entries(context.filters ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
  return <div className={`flex flex-wrap items-center gap-1.5 text-xs text-slate-600 ${className}`} aria-label="AI 分析上下文">
    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">✨ AI 上下文</span>
    <span className="rounded-full bg-slate-100 px-2.5 py-1">{pageLabels[context.page]} / {moduleLabels[context.module]}</span>
    <span className="rounded-full bg-slate-100 px-2.5 py-1">孩子：{context.childLabel}</span>
    {range && <span className="rounded-full bg-slate-100 px-2.5 py-1">{range}</span>}
    {filterText && <span className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1">{filterText}</span>}
  </div>;
}
