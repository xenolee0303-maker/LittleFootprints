import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { aiProviderConfigTable } from '../db/schema/ai-provider-config.js';
import { eq } from 'drizzle-orm';
import type { AiProviderConfig, CreateAiProviderConfigRequest, UpdateAiProviderConfigRequest } from '@littlefootprints/shared';
import { OpenAICompatibleProvider } from './ai-provider.js';

const ALGORITHM = 'aes-256-gcm';
const keyFor = (secret: string) => createHash('sha256').update(secret).digest();
const encryptionKey = () => process.env.AI_CONFIG_ENCRYPTION_KEY ?? (process.env.NODE_ENV === 'test' ? 'test-only-ai-config-key' : undefined);

export function encryptSecret(value: string, secret = encryptionKey()): string {
  if (!secret) throw new Error('AI_CONFIG_ENCRYPTION_KEY is required to store an API key');
  const iv = randomBytes(12); const cipher = createCipheriv(ALGORITHM, keyFor(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, secret = encryptionKey()): string {
  if (!secret) throw new Error('AI_CONFIG_ENCRYPTION_KEY is required to read an API key');
  const [ivText, tagText, dataText] = value.split('.');
  if (!ivText || !tagText || !dataText) throw new Error('invalid encrypted secret');
  const decipher = createDecipheriv(ALGORITHM, keyFor(secret), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}

export const maskSecret = (configured: boolean): string => configured ? '已配置' : '未配置';
function now() { return new Date().toISOString(); }
async function getDb() { return (await import('../db/index.js')).db; }
function exposed(row: typeof aiProviderConfigTable.$inferSelect): AiProviderConfig {
  return { id: row.id, provider: row.provider, mode: row.mode as AiProviderConfig['mode'], model: row.model ?? undefined, endpoint: row.endpoint ?? undefined, timeoutMs: row.timeoutMs ?? undefined, maxInputTokens: row.maxInputTokens ?? undefined, maxOutputTokens: row.maxOutputTokens ?? undefined, apiKeyConfigured: Boolean(row.apiKeyEncrypted), enabled: row.enabled, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
function validate(input: { provider?: string; mode?: string; model?: string; endpoint?: string; timeoutMs?: number; maxInputTokens?: number; maxOutputTokens?: number }) {
  if (input.provider !== undefined && !input.provider.trim()) throw new Error('provider is required');
  if (input.mode !== undefined && input.mode !== 'cloud' && input.mode !== 'local') throw new Error('mode must be cloud or local');
  if (input.endpoint !== undefined && !/^https?:\/\//i.test(input.endpoint)) throw new Error('endpoint must be an http URL');
  for (const [name, value] of [['timeoutMs', input.timeoutMs], ['maxInputTokens', input.maxInputTokens], ['maxOutputTokens', input.maxOutputTokens]] as const) if (value !== undefined && (!Number.isInteger(value) || value < 1)) throw new Error(`${name} must be a positive integer`);
}

export async function list(): Promise<AiProviderConfig[]> { const db = await getDb(); return (await db.select().from(aiProviderConfigTable).all()).map(exposed); }
export async function getDefaultProviderId(): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.select({ id: aiProviderConfigTable.id }).from(aiProviderConfigTable).where(eq(aiProviderConfigTable.enabled, true)).limit(1).get();
  return row?.id;
}
export async function get(id: string): Promise<AiProviderConfig | null> { const db = await getDb(); const row = await db.select().from(aiProviderConfigTable).where(eq(aiProviderConfigTable.id, id)).get(); return row ? exposed(row) : null; }
export async function create(input: CreateAiProviderConfigRequest): Promise<AiProviderConfig> {
  validate(input); const timestamp = now(); const id = crypto.randomUUID();
  const row = { id, provider: input.provider.trim(), mode: input.mode, model: input.model ?? null, endpoint: input.endpoint ?? null, timeoutMs: input.timeoutMs ?? 30_000, maxInputTokens: input.maxInputTokens ?? 16_000, maxOutputTokens: input.maxOutputTokens ?? 2_000, apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey) : null, enabled: input.enabled ?? true, createdAt: timestamp, updatedAt: timestamp };
  const db = await getDb(); await db.insert(aiProviderConfigTable).values(row).run(); return exposed(row);
}
export async function update(id: string, input: UpdateAiProviderConfigRequest): Promise<AiProviderConfig | null> {
  validate(input); const db = await getDb(); const existing = await db.select().from(aiProviderConfigTable).where(eq(aiProviderConfigTable.id, id)).get(); if (!existing) return null;
  const patch: Partial<typeof existing> = { updatedAt: now() };
  if (input.mode !== undefined) patch.mode = input.mode; if (input.model !== undefined) patch.model = input.model; if (input.endpoint !== undefined) patch.endpoint = input.endpoint; if (input.timeoutMs !== undefined) patch.timeoutMs = input.timeoutMs; if (input.maxInputTokens !== undefined) patch.maxInputTokens = input.maxInputTokens; if (input.maxOutputTokens !== undefined) patch.maxOutputTokens = input.maxOutputTokens; if (input.enabled !== undefined) patch.enabled = input.enabled; if (input.apiKey !== undefined) patch.apiKeyEncrypted = input.apiKey ? encryptSecret(input.apiKey) : null;
  await db.update(aiProviderConfigTable).set(patch).where(eq(aiProviderConfigTable.id, id)).run(); return get(id);
}
export async function remove(id: string): Promise<boolean> { const db = await getDb(); const result = await db.delete(aiProviderConfigTable).where(eq(aiProviderConfigTable.id, id)).run(); return result.changes > 0; }
export async function providerFor(id: string): Promise<OpenAICompatibleProvider> {
  const db = await getDb(); const row = await db.select().from(aiProviderConfigTable).where(eq(aiProviderConfigTable.id, id)).get(); if (!row) throw new Error('AI provider config not found');
  return new OpenAICompatibleProvider({ endpoint: row.endpoint ?? '', model: row.model ?? '', apiKey: row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : undefined, timeoutMs: row.timeoutMs ?? undefined, maxInputTokens: row.maxInputTokens ?? undefined, maxOutputTokens: row.maxOutputTokens ?? undefined });
}
export async function testConnection(id: string): Promise<{ ok: true; model?: string }> { return (await providerFor(id)).testConnection(); }
