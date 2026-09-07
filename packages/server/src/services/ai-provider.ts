import { AiProviderError } from './ai-reliability.js';

export type AiRole = 'system' | 'user' | 'assistant';
export interface AiChatMessage { role: AiRole; content: string }
export interface AiChatRequest { messages: AiChatMessage[]; maxOutputTokens?: number; temperature?: number; responseFormat?: 'json_object' | 'text' }
export interface AiChatResponse { text: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }; model?: string }
export interface AiProvider { complete(request: AiChatRequest): Promise<AiChatResponse>; testConnection(): Promise<{ ok: true; model?: string }>; }
export interface OpenAICompatibleProviderOptions { endpoint: string; model: string; apiKey?: string; timeoutMs?: number; maxInputTokens?: number; maxOutputTokens?: number; fetcher?: typeof fetch }

function normalizeEndpoint(endpoint: string): string {
  const value = endpoint.trim().replace(/\/+$/, '');
  if (!value) throw new Error('provider endpoint is required');
  return value.endsWith('/chat/completions') ? value : `${value}/chat/completions`;
}

function errorForHttpStatus(status: number): AiProviderError {
  const message = `provider request failed (${status})`;
  if (status === 401 || status === 403) {
    return new AiProviderError('provider_authentication', message, { retryable: false, status });
  }
  if (status === 408) {
    return new AiProviderError('provider_timeout', message, { retryable: true, status });
  }
  if (status === 429) {
    return new AiProviderError('provider_rate_limited', message, { retryable: true, status });
  }
  if (status >= 500) {
    return new AiProviderError('provider_unavailable', message, { retryable: true, status });
  }
  return new AiProviderError('provider_invalid_request', message, { retryable: false, status });
}

export class OpenAICompatibleProvider implements AiProvider {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxInputTokens: number;
  private readonly maxOutputTokens: number;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenAICompatibleProviderOptions) {
    if (!options.model?.trim()) throw new Error('provider model is required');
    this.endpoint = normalizeEndpoint(options.endpoint);
    this.model = options.model.trim();
    this.apiKey = options.apiKey;
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 30_000);
    this.maxInputTokens = Math.max(1, options.maxInputTokens ?? 16_000);
    this.maxOutputTokens = Math.max(1, options.maxOutputTokens ?? 2_000);
    this.fetcher = options.fetcher ?? fetch;
  }

  async complete(request: AiChatRequest): Promise<AiChatResponse> {
    const inputChars = request.messages.reduce((total, message) => total + message.content.length, 0);
    // A conservative character estimate prevents an accidental unbounded request while
    // avoiding a tokenizer dependency in the server process.
    if (Math.ceil(inputChars / 4) > this.maxInputTokens) {
      throw new AiProviderError('input_too_large', 'input exceeds configured limit', { retryable: false });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: request.messages,
        max_tokens: Math.min(request.maxOutputTokens ?? this.maxOutputTokens, this.maxOutputTokens),
      };
      if (request.temperature !== undefined) body.temperature = request.temperature;
      if (request.responseFormat !== undefined) body.response_format = { type: request.responseFormat };
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      const response = await this.fetcher(this.endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const raw = await response.text();
      if (!response.ok) throw errorForHttpStatus(response.status);
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch {
        // JSON.parse errors can include fragments of the provider response. Do not
        // retain them as a cause because model output may contain private data.
        throw new AiProviderError('provider_unavailable', 'provider returned invalid JSON', { retryable: true });
      }
      const text = parsed?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiProviderError('provider_unavailable', 'provider response missing message content', { retryable: true });
      }
      const usage = parsed.usage ? { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens, totalTokens: parsed.usage.total_tokens } : undefined;
      return { text, usage, model: typeof parsed.model === 'string' ? parsed.model : this.model };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('provider_timeout', 'provider request timed out', { retryable: true, cause: error });
      }
      throw new AiProviderError('provider_unavailable', 'provider request failed', { retryable: true, cause: error });
    } finally { clearTimeout(timer); }
  }

  async testConnection(): Promise<{ ok: true; model?: string }> {
    await this.complete({ messages: [{ role: 'user', content: 'Reply with OK.' }], maxOutputTokens: 8 });
    return { ok: true, model: this.model };
  }
}

export function createAiProvider(options: OpenAICompatibleProviderOptions): AiProvider { return new OpenAICompatibleProvider(options); }
