import { useState } from 'react';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { Child } from '@bloommate/shared';

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post<Child>('/children', { name: name.trim() });
      onComplete();
    } catch {
      setError('创建失败，请重试');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-900">欢迎使用 BloomMate 🌱</h1>
        <p className="mt-3 text-center text-sm text-slate-500">
          家庭成长档案：记录孩子的兴趣、经历、身高体重和照片，生成每周的成长亮点。
        </p>
        <div className="mt-8 space-y-4">
          <Input
            label="第一个孩子的名字"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="如：小明"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
          />
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <Button className="w-full" size="lg" loading={submitting} disabled={!name.trim()} onClick={() => void submit()}>
            开始记录成长
          </Button>
          <p className="text-center text-xs text-slate-400">之后可以在设置里添加更多孩子</p>
        </div>
      </section>
    </main>
  );
}
