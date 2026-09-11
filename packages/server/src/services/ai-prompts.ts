import type { AnalysisContextSnapshot, AnalysisSnapshot } from '@littlefootprints/shared';
import type { AiChatMessage } from './ai-provider.js';
import type { AiReportInput } from './ai-report-input.js';

export const AI_PROMPT_VERSION = 'littlefootprints-ai-prompts.v1';

const reportRules = `你是家庭成长记录的分析助手，服务对象是记录孩子兴趣与成长经历的家庭。只根据提供的结构化快照和证据解释，不自行计算或编造数字。不得读取网页 DOM、家庭 PIN、模型配置或其他孩子的数据；不得进行医学、心理或人格诊断，不给孩子贴标签；快照 health 字段（过敏、基础疾病等）仅供理解孩子处境和活动安排的合理性，不得据此给出诊断、用药或治疗建议，涉及健康问题应建议咨询医生。输出必须是纯 JSON，不能使用 Markdown 代码围栏。所有观察和建议必须引用 evidenceIds；其中出现的每一个数字，都必须在该条 evidenceIds 中包含 value 完全一致的证据，不能通过其他数字推导。`;

const reportSchema = `输出 schemaVersion 为 "ai-report.v1"，字段为 summary、observations[{title,text,evidenceIds,confidence}]、recommendations[{title,text,evidenceIds}]、childSummary{title,text,goal}。`;

function json(value: unknown): string { return JSON.stringify(value); }
function messages(system: string, user: string): AiChatMessage[] { return [{ role: 'system', content: system }, { role: 'user', content: user }]; }

export function buildWeeklyReportPrompt(input: AiReportInput): AiChatMessage[] {
  const growthRule = input.growth ? '\n快照 growth 字段包含孩子背景和兴趣列表：growth.background/schoolStage 仅供理解孩子处境，不是证据；growth.interests[].recentFourWeekNoteCounts 表示该兴趣近四周（下标 0 为统计周）的进展条数，可用于讨论坚持与节奏；日志（journal 证据）记录了孩子每天的状态和心情，可用于观察情绪与生活节奏；health.allergies/chronicConditions 可帮助理解孩子的活动安排（如哮喘对运动强度的影响）；兴趣进展、成长事件与日志的分析必须引用对应 evidenceIds。' : '';
  return messages(
    `${reportRules}\n${reportSchema}\n周报可向家长解释兴趣爱好和成长经历（旅游、比赛、演出、聚会等）中的表现与趋势；数据不足时明确说不能判断。${growthRule}`,
    `生成本周家长周报。快照（仅限当前孩子）:\n${json(input)}`,
  );
}

export function buildReportRepairPrompt(input: AiReportInput, candidate: string, failureCode: string): AiChatMessage[] {
  const evidenceRepairRule = failureCode === 'invalid_evidence'
    ? '对于没有对应 evidence value 的数字，删除该数字或把整句改写为不含数字的定性描述；不得用推算值或新数字替换。兴趣和事件名称中的原有数字字样必须保持完整。'
    : '';
  return messages(
    `${reportRules}\n${reportSchema}\n只修复格式、字段结构或无证据表达，不得改变任何有证据支持的事实，不得引入新事实。${evidenceRepairRule}输出一个纯 JSON 对象。`,
    `失败类型：${failureCode}\n允许使用的分析输入：${json(input)}\n待修复内容：${candidate.slice(0, 16_000)}`,
  );
}

export function buildQuestionPrompt(context: AnalysisContextSnapshot, question: string): AiChatMessage[] {
  const questionRules = `你是家庭成长记录的分析助手。只根据锁定的结构化快照和证据回答，不自行计算或编造数字。不得读取网页 DOM、家庭 PIN、模型配置或其他孩子的数据；不得进行医学、心理或人格诊断，不给孩子贴标签。回答使用简洁的纯文字，不要输出 JSON、字段名、evidenceId 或 Markdown 代码。先给直接结论，再用一两句话说明依据；如果数据不足要明确说明。`;
  return messages(
    `${questionRules}\n回答只能使用锁定的 page/module/date/filter 上下文；不要假设上下文以外的记录。`,
    `锁定上下文:\n${json({ page: context.page, module: context.module, childId: context.childId, childLabel: context.childLabel, dateFrom: context.dateFrom, dateTo: context.dateTo, filters: context.filters, snapshot: context.snapshot })}\n家长问题：${question}`,
  );
}

export const buildWeeklyReportMessages = buildWeeklyReportPrompt;
export const buildContextQuestionPrompt = buildQuestionPrompt;
