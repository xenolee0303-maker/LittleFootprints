const BASE_URL = '/api';
const AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/status']);

function normalizePath(path: string) {
  return path.split(/[?#]/, 1)[0].replace(/\/+$/, '');
}

export const AUTH_REQUIRED_EVENT = 'littlefootprints-auth-required';

let authenticationGeneration = 0;
let authenticationInvalidated = false;

export function markAuthenticationEstablished() {
  authenticationGeneration += 1;
  authenticationInvalidated = false;
}

export class ApiError<TBody = unknown> extends Error {
  readonly status: number;
  readonly body: TBody | null;
  readonly failureCode?: string;
  readonly failureStage?: string;

  constructor(message: string, status: number, body: TBody | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    const structured = body && typeof body === 'object' ? body as { failureCode?: unknown; failureStage?: unknown } : undefined;
    this.failureCode = typeof structured?.failureCode === 'string' ? structured.failureCode : undefined;
    this.failureStage = typeof structured?.failureStage === 'string' ? structured.failureStage : undefined;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const requestGeneration = authenticationGeneration;
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    if (
      res.status === 401 &&
      !AUTH_ENDPOINTS.has(normalizePath(path)) &&
      requestGeneration === authenticationGeneration &&
      !authenticationInvalidated
    ) {
      authenticationInvalidated = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
      }
    }

    const error = await res.json().catch(() => null) as { message?: unknown } | null;
    const message =
      typeof error?.message === 'string' && error.message
        ? error.message
        : res.statusText || `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, error);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
