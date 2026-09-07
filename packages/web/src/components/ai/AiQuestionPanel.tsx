import { useState } from 'react';
import type { AnalysisContextSnapshot, AiSavedConversation } from '@bloommate/shared';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { AiContextBadge } from './AiContextBadge';
import { useAskAiConversation, useCreateAiConversation, useSaveAiConversation } from '../../hooks/useAiAnalysis';

export interface AiQuestionPanelProps {
  context: AnalysisContextSnapshot;
  title?: string;
  compact?: boolean;
  savedConversations?: AiSavedConversation[];
}

export function AiQuestionPanel({ context, title = '问问 AI', compact = false, savedConversations = [] }: AiQuestionPanelProps) {
  const [question, setQuestion] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const create = useCreateAiConversation();
  const ask = useAskAiConversation();
  const save = useSaveAiConversation();
  const busy = create.isPending || ask.isPending;

  const ensureConversation = (onReady: (id: string) => void) => {
    if (conversationId) return onReady(conversationId);
    create.mutate({ childId: context.childId, context, title: `${context.childLabel}的${title}` }, { onSuccess: (result) => { setConversationId(result.conversation.id); onReady(result.conversation.id); } });
  };
  const submit = () => {
    const text = question.trim();
    if (!text || busy) return;
    ensureConversation((id) => ask.mutate({ id, childId: context.childId, question: text }, { onSuccess: (result) => { setMessages(result.messages ?? [...messages, { role: 'user', content: text }, { role: 'assistant', content: result.answer }]); setQuestion(''); } }));
  };
  const saveConversation = () => { if (conversationId) save.mutate({ id: conversationId, childId: context.childId, title: `${context.childLabel}的${title}` }); };

  return <Card className={`${compact ? 'p-3' : 'p-4'} border-indigo-100`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">问题只会使用当前锁定的页面数据。</p></div><AiContextBadge context={context} /></div>
    <div className="mt-3 flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="例如：这部分数据有什么变化？" aria-label="输入问题" /><Button size="sm" loading={busy} disabled={!question.trim()} onClick={submit}>提问</Button></div>
    {(create.isError || ask.isError) && <p role="alert" className="mt-2 text-xs text-rose-600">{(create.error ?? ask.error)?.message ?? '暂时无法连接 AI，请稍后重试。'}</p>}
    {messages.length > 0 && <div className="mt-3 space-y-2" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`rounded-lg p-3 text-sm leading-6 ${message.role === 'assistant' ? 'bg-indigo-50 text-slate-700' : 'bg-slate-50 text-slate-600'}`}><span className="mr-1 font-medium">{message.role === 'assistant' ? 'AI' : '我'}：</span>{message.content}</div>)}</div>}
    {conversationId && messages.length > 0 && <div className="mt-3 flex justify-end"><Button size="sm" variant="secondary" loading={save.isPending} onClick={saveConversation}>保存本次问答</Button></div>}
    {savedConversations.length > 0 && <details className="mt-3 border-t border-slate-100 pt-2"><summary className="cursor-pointer text-xs text-slate-500">已保存问答（{savedConversations.length}）</summary><ul className="mt-2 space-y-1">{savedConversations.slice(0, 5).map((item) => <li key={item.id} className="text-xs text-indigo-600">{item.title ?? '未命名问答'}</li>)}</ul></details>}
  </Card>;
}
