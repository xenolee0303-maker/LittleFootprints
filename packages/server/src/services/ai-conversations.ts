import { and, eq, desc } from 'drizzle-orm';
import type { AiConversationMessage, AiSavedConversation, AnalysisContextSnapshot } from '@bloommate/shared';
import { db } from '../db/index.js';
import { aiSavedConversationTable } from '../db/schema/ai-analysis-report.js';
import { buildQuestionPrompt } from './ai-prompts.js';
import { providerFor } from './ai-provider-config.js';
import { getDefaultProviderId } from './ai-provider-config.js';
import type { AiProvider } from './ai-provider.js';

export interface CreateConversationInput {
  context: AnalysisContextSnapshot;
  provider?: AiProvider;
  providerId?: string;
  now?: () => string;
}

export interface AskConversationOptions {
  provider?: AiProvider;
  providerId?: string;
  now?: () => string;
}

export interface ActiveAiConversation {
  id: string;
  context: AnalysisContextSnapshot;
  messages: AiConversationMessage[];
  providerId?: string;
  createdAt: string;
  updatedAt: string;
  savedId?: string;
}

export interface ConversationAnswer {
  conversationId: string;
  answer: string;
  messages: AiConversationMessage[];
  context: AnalysisContextSnapshot;
  evidenceIds: string[];
}

const activeConversations = new Map<string, ActiveAiConversation & { provider?: AiProvider }>();

function timestamp(now?: () => string): string { return (now ?? (() => new Date().toISOString()))(); }

/** Clone and recursively freeze values so later caller mutations cannot alter the locked context. */
function lock<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) lock(child);
    Object.freeze(value);
  }
  return value;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function cleanAnswer(raw: string): string {
  const text = raw.trim().replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const parts = ['summary', 'interpretation', 'answer', 'text', 'message']
      .map((key) => parsed[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
    return Array.from(new Set(parts)).join('\n\n') || text;
  } catch {
    return text;
  }
}

function validateContext(context: AnalysisContextSnapshot): void {
  if (!context || typeof context !== 'object') throw new Error('context is required');
  if (!context.childId?.trim()) throw new Error('context childId is required');
  if (!context.page || !context.module) throw new Error('context page and module are required');
  if (!context.snapshot || context.snapshot.childId !== context.childId) throw new Error('context snapshot does not match child');
  if (context.dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(context.dateFrom)) throw new Error('context dateFrom is invalid');
  if (context.dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(context.dateTo)) throw new Error('context dateTo is invalid');
}

async function resolveProvider(options: { provider?: AiProvider; providerId?: string; stored?: AiProvider }): Promise<AiProvider> {
  if (options.provider) return options.provider;
  if (options.stored) return options.stored;
  if (options.providerId) return providerFor(options.providerId);
  throw new Error('AI provider is not configured');
}

export function getActiveConversation(id: string): ActiveAiConversation | null {
  const conversation = activeConversations.get(id);
  if (!conversation) return null;
  return { id: conversation.id, context: conversation.context, messages: clone(conversation.messages), providerId: conversation.providerId, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt, savedId: conversation.savedId };
}

export async function createConversation(input: CreateConversationInput): Promise<ActiveAiConversation> {
  validateContext(input.context);
  const now = timestamp(input.now);
  const id = crypto.randomUUID();
  const providerId = input.providerId ?? await getDefaultProviderId();
  // Keep the provider object out of the returned value; it may contain credentials.
  const conversation = { id, context: lock(clone(input.context)), messages: [], providerId, createdAt: now, updatedAt: now, provider: input.provider } as ActiveAiConversation & { provider?: AiProvider };
  activeConversations.set(id, conversation);
  return getActiveConversation(id)!;
}

export async function askConversation(id: string, question: string, options: AskConversationOptions = {}): Promise<ConversationAnswer> {
  const conversation = activeConversations.get(id);
  if (!conversation) throw new Error('conversation not found');
  const text = question?.trim();
  if (!text) throw new Error('question is required');
  if (text.length > 4000) throw new Error('question is too long');
  const provider = await resolveProvider({ provider: options.provider, providerId: options.providerId ?? conversation.providerId, stored: conversation.provider });
  const result = await provider.complete({ messages: buildQuestionPrompt(conversation.context, text), responseFormat: 'text', maxOutputTokens: 1200, temperature: 0.2 });
  const now = timestamp(options.now);
  const userMessage: AiConversationMessage = { role: 'user', content: text, createdAt: now };
  const answer = cleanAnswer(result.text);
  const assistantMessage: AiConversationMessage = { role: 'assistant', content: answer, createdAt: now };
  conversation.messages.push(userMessage, assistantMessage);
  conversation.updatedAt = now;
  return { conversationId: id, answer, messages: clone(conversation.messages), context: conversation.context, evidenceIds: conversation.context.snapshot.evidence.map((item) => item.id) };
}

function exposeSaved(row: typeof aiSavedConversationTable.$inferSelect): AiSavedConversation {
  let messages: AiConversationMessage[] = [];
  try { messages = JSON.parse(row.messagesJson) as AiConversationMessage[]; } catch { /* old/corrupt records remain inspectable as empty */ }
  return { id: row.id, childId: row.childId ?? undefined, title: row.title ?? undefined, contextJson: row.contextJson ?? undefined, messages, evidenceJson: row.evidenceJson ?? undefined, provider: row.provider ?? undefined, model: row.model ?? undefined, savedAt: row.savedAt ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function saveConversation(id: string, input: { title?: string; now?: () => string } = {}): Promise<AiSavedConversation> {
  const conversation = activeConversations.get(id);
  if (!conversation) throw new Error('conversation not found');
  if (!conversation.messages.length) throw new Error('conversation has no messages');
  if (conversation.savedId) {
    const existing = await getSavedConversation(conversation.savedId, conversation.context.childId);
    if (existing) return existing;
  }
  const now = timestamp(input.now);
  const title = input.title?.trim().slice(0, 120) || null;
  const row = { id: crypto.randomUUID(), childId: conversation.context.childId, title, contextJson: JSON.stringify(conversation.context), messagesJson: JSON.stringify(conversation.messages), evidenceJson: JSON.stringify(conversation.context.snapshot.evidence.map((item) => item.id)), provider: conversation.providerId ?? null, model: null, savedAt: now, createdAt: now, updatedAt: now };
  await db.insert(aiSavedConversationTable).values(row).run();
  conversation.savedId = row.id;
  return exposeSaved(row as typeof aiSavedConversationTable.$inferSelect);
}

export async function getSavedConversation(id: string, childId?: string): Promise<AiSavedConversation | null> {
  const clauses = childId ? [eq(aiSavedConversationTable.id, id), eq(aiSavedConversationTable.childId, childId)] : [eq(aiSavedConversationTable.id, id)];
  const row = await db.select().from(aiSavedConversationTable).where(and(...clauses)).get();
  return row ? exposeSaved(row) : null;
}

export async function listSavedConversations(childId: string): Promise<AiSavedConversation[]> {
  if (!childId?.trim()) throw new Error('childId is required');
  const rows = await db.select().from(aiSavedConversationTable).where(eq(aiSavedConversationTable.childId, childId)).orderBy(desc(aiSavedConversationTable.updatedAt)).all();
  return rows.map(exposeSaved);
}

/** Test/support hook; active contexts are deliberately process-local and never persisted before save. */
export function clearActiveConversations(): void { activeConversations.clear(); }
