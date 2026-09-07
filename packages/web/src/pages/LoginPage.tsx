import { FormEvent, useState } from 'react';
import { ApiError, api, markAuthenticationEstablished } from '../api/client';

interface LoginPageProps {
  onAuthenticated: () => void;
}

function loginErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return '无法连接服务';
  if (error.status === 400) return '请输入6位数字';
  if (error.status === 401) return 'PIN不正确';
  if (error.status === 429) return '尝试次数过多，请稍后再试';
  return '服务暂时不可用';
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pin.length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/login', { pin });
    } catch (loginError) {
      setPin('');
      setIsSubmitting(false);
      setError(loginErrorMessage(loginError));
      return;
    }

    setPin('');
    setIsSubmitting(false);
    markAuthenticationEstablished();
    onAuthenticated();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-900">BloomMate</h1>
        <p className="mt-1 text-center text-xs text-slate-400">家庭成长档案</p>
        <p className="mt-2 text-center text-sm text-slate-500">请输入家庭 PIN 进入</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            aria-label="家庭 PIN"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            inputMode="numeric"
            maxLength={6}
            name="password"
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            type="password"
            value={pin}
          />

          {error && (
            <p className="text-center text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={pin.length !== 6 || isSubmitting}
            type="submit"
          >
            {isSubmitting ? '正在进入...' : '进入家庭空间'}
          </button>
        </form>
      </section>
    </main>
  );
}
