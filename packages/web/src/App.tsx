import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_REQUIRED_EVENT, ApiError, api } from './api/client';
import { MobileLayout } from './layouts/MobileLayout';
import { DesktopLayout } from './layouts/DesktopLayout';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';
import { PerspectiveProvider } from './lib/perspective';
import type { Child } from '@bloommate/shared';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'unavailable';

export default function App() {
  const queryClient = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authAttempt, setAuthAttempt] = useState(0);
  const authCheckVersion = useRef(0);

  const { data: children, isLoading, error, refetch } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get<Child[]>('/children'),
    enabled: authState === 'authenticated' && !onboardingDone,
  });

  useEffect(() => {
    const checkVersion = ++authCheckVersion.current;
    let active = true;

    api.get('/auth/status').then(
      () => {
        if (active && checkVersion === authCheckVersion.current) {
          setAuthState('authenticated');
        }
      },
      (statusError) => {
        if (!active || checkVersion !== authCheckVersion.current) return;
        setAuthState(
          statusError instanceof ApiError && statusError.status === 401
            ? 'unauthenticated'
            : 'unavailable',
        );
      },
    );

    return () => {
      active = false;
    };
  }, [authAttempt]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleAuthRequired = () => {
      authCheckVersion.current += 1;
      queryClient.clear();
      setOnboardingDone(false);
      setAuthState('unauthenticated');
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [queryClient]);

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };

  const handleAuthenticated = () => {
    queryClient.clear();
    setOnboardingDone(false);
    setAuthState('authenticated');
  };

  const retryAuthentication = () => {
    setAuthState('checking');
    setAuthAttempt((attempt) => attempt + 1);
  };

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-600">
        正在连接服务...
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  if (authState === 'unavailable') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">无法连接服务</h1>
          <button
            className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white"
            onClick={retryAuthentication}
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-600">
        正在连接服务...
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">无法连接服务</h1>
          <button
            className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white"
            onClick={() => refetch()}
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // First visit: no children exist -> show onboarding
  if (!onboardingDone && children && children.length === 0) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen">
      <PerspectiveProvider>
        {isDesktop ? <DesktopLayout /> : <MobileLayout />}
      </PerspectiveProvider>
    </div>
  );
}
