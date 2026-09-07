export type AiProviderErrorCode =
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_authentication'
  | 'provider_invalid_request'
  | 'input_too_large';

export interface AiProviderErrorOptions {
  retryable: boolean;
  status?: number;
  cause?: unknown;
}

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: AiProviderErrorCode, message: string, options: AiProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'AiProviderError';
    this.code = code;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export interface TransientRetryOptions {
  delayMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
}

const defaultDelay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const delayMs = options.delayMs ?? 500;
  const delay = options.delay ?? defaultDelay;

  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof AiProviderError) || !error.retryable) throw error;
    await delay(delayMs);
    return operation();
  }
}
