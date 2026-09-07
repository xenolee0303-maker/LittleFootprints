import { useEffect, useState } from 'react';
import type { AiProviderConfig, AiProviderMode } from '@bloommate/shared';
import { useAiProviders, useCreateAiProvider, useDeleteAiProvider, useTestAiProvider, useUpdateAiProvider } from '../../hooks/useAiAnalysis';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type FormState = { provider: string; mode: AiProviderMode; model: string; endpoint: string; apiKey: string; timeoutMs: string; maxInputTokens: string; maxOutputTokens: string; enabled: boolean };
const emptyForm: FormState = { provider: 'OpenAI compatible', mode: 'cloud', model: '', endpoint: '', apiKey: '', timeoutMs: '30000', maxInputTokens: '16000', maxOutputTokens: '2000', enabled: true };

function toForm(config?: AiProviderConfig): FormState {
  return config ? { provider: config.provider, mode: config.mode, model: config.model ?? '', endpoint: config.endpoint ?? '', apiKey: '', timeoutMs: String(config.timeoutMs ?? 30000), maxInputTokens: String(config.maxInputTokens ?? 16000), maxOutputTokens: String(config.maxOutputTokens ?? 2000), enabled: config.enabled } : emptyForm;
}

export function AiProviderSettings() {
  const { data: providers, isLoading, isError, refetch } = useAiProviders();
  const create = useCreateAiProvider();
  const update = useUpdateAiProvider();
  const test = useTestAiProvider();
  const remove = useDeleteAiProvider();
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const selected = providers?.find((item) => item.id === selectedId) ?? providers?.[0];
    if (selected) { setSelectedId(selected.id); setForm(toForm(selected)); }
    else if (providers && providers.length === 0) { setSelectedId(undefined); setForm(emptyForm); }
  }, [providers, selectedId]);

  const set = (key: keyof FormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    setMessage(undefined);
    const input = { provider: form.provider, mode: form.mode, model: form.model || undefined, endpoint: form.endpoint || undefined, apiKey: form.apiKey || undefined, timeoutMs: Number(form.timeoutMs), maxInputTokens: Number(form.maxInputTokens), maxOutputTokens: Number(form.maxOutputTokens), enabled: form.enabled };
    const onSuccess = () => { setMessage('设置已保存，密钥仅保存在服务端并已加密。'); setForm((current) => ({ ...current, apiKey: '' })); };
    if (selectedId) update.mutate({ id: selectedId, input }, { onSuccess });
    else create.mutate(input, { onSuccess });
  };
  const selected = providers?.find((item) => item.id === selectedId);

  if (isLoading) return <p className="text-sm text-gray-500">正在加载 AI 服务设置...</p>;
  if (isError) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">AI 服务设置加载失败。<button type="button" className="ml-2 underline" onClick={() => void refetch()}>重试</button></div>;
  return <Card className="p-4 space-y-4">
    <div><h2 className="font-semibold text-slate-900">AI 服务提供方</h2><p className="mt-1 text-sm text-slate-500">支持云端或家庭内网的 OpenAI-compatible 服务。API 密钥不会回显。</p></div>
    {providers && providers.length > 0 && <div className="flex flex-wrap gap-2" role="list" aria-label="已配置服务"><select aria-label="选择服务提供方" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={selectedId} onChange={(event) => { const config = providers.find((item) => item.id === event.target.value); setSelectedId(event.target.value); setForm(toForm(config)); setMessage(undefined); }}><option value="" disabled>选择服务</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.provider} · {item.mode === 'cloud' ? '云端' : '本地'}{item.enabled ? '' : '（已停用）'}</option>)}</select><Button size="sm" variant="ghost" onClick={() => { setSelectedId(undefined); setForm(emptyForm); setMessage(undefined); }}>新增服务</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="服务名称" value={form.provider} onChange={(event) => set('provider', event.target.value)} placeholder="例如 OpenAI compatible" />
      <label className="space-y-1 text-sm font-medium text-gray-700">模式<select aria-label="服务模式" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.mode} onChange={(event) => set('mode', event.target.value as AiProviderMode)}><option value="cloud">云端</option><option value="local">本地</option></select></label>
      <Input label="模型名称" value={form.model} onChange={(event) => set('model', event.target.value)} placeholder="例如 gpt-4o-mini" />
      <Input label="接口地址" value={form.endpoint} onChange={(event) => set('endpoint', event.target.value)} placeholder="https://.../v1/chat/completions" />
      <Input label={selected?.apiKeyConfigured ? 'API 密钥（留空则保持原密钥）' : 'API 密钥'} type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => set('apiKey', event.target.value)} placeholder={selected?.apiKeyConfigured ? '已配置，输入新值可替换' : '可选'} />
      <Input label="超时（毫秒）" inputMode="numeric" value={form.timeoutMs} onChange={(event) => set('timeoutMs', event.target.value)} />
      <Input label="最大输入 token" inputMode="numeric" value={form.maxInputTokens} onChange={(event) => set('maxInputTokens', event.target.value)} />
      <Input label="最大输出 token" inputMode="numeric" value={form.maxOutputTokens} onChange={(event) => set('maxOutputTokens', event.target.value)} />
    </div>
    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.enabled} onChange={(event) => set('enabled', event.target.checked)} />启用此服务</label>
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {(create.isError || update.isError || remove.isError) && <p role="alert" className="text-sm text-rose-700">设置保存失败，请检查填写内容后重试。</p>}
    {test.isError && <p role="alert" className="text-sm text-rose-700">连接测试失败，请检查地址、模型和网络。</p>}
    {test.isSuccess && <p role="status" className="text-sm text-emerald-700">连接成功{test.data.result.model ? `（${test.data.result.model}）` : ''}。</p>}
    <div className="flex flex-wrap gap-2"><Button loading={create.isPending || update.isPending} onClick={save}>保存设置</Button>{selectedId && <Button variant="secondary" loading={test.isPending} onClick={() => test.mutate(selectedId)}>测试连接</Button>}{selectedId && <Button variant="danger" loading={remove.isPending} onClick={() => { if (window.confirm('确定删除此 AI 服务配置吗？')) remove.mutate(selectedId, { onSuccess: () => { setSelectedId(undefined); setForm(emptyForm); } }); }}>删除配置</Button>}</div>
  </Card>;
}
