import type { FastifyInstance } from 'fastify';
import * as conversations from '../services/ai-conversations.js';
import { createAnalysisContext } from '../services/ai-context.js';

function status(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('provider')) return 503;
  if (message.includes('required') || message.includes('invalid') || message.includes('too long') || message.includes('no messages')) return 400;
  return 500;
}

export async function aiConversationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/ai/conversations', async (request, reply) => {
    const childId = (request.query as { child_id?: string; childId?: string }).child_id ?? (request.query as { child_id?: string; childId?: string }).childId;
    try { return { conversations: await conversations.listSavedConversations(childId ?? '') }; }
    catch (error) { return reply.status(status(error)).send({ message: error instanceof Error ? error.message : '读取问答失败' }); }
  });
  app.get('/api/ai/conversations/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const childId = (request.query as { child_id?: string; childId?: string }).child_id ?? (request.query as { child_id?: string; childId?: string }).childId;
    if (!childId) return reply.status(400).send({ message: 'child_id is required' });
    const active = conversations.getActiveConversation(id);
    if (active) return active.context.childId === childId ? { conversation: active } : reply.status(403).send({ message: '无权访问该孩子的问答' });
    const saved = await conversations.getSavedConversation(id, childId);
    return saved ? { conversation: saved } : reply.status(404).send({ message: 'conversation not found' });
  });
  app.post('/api/ai/conversations', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body?.childId && !body?.child_id) return reply.status(400).send({ message: 'child_id is required' });
      if (body.childId && body.child_id && body.childId !== body.child_id) return reply.status(400).send({ message: 'child_id does not match context' });
      const childId = body.childId ?? body.child_id;
      if (body.context?.childId !== childId) return reply.status(403).send({ message: 'child_id does not match context' });
      // Never trust a client-supplied snapshot. Rebuild the locked context from
      // the server-side snapshot service using only the page/module/date/filter scope.
      const requested = body.context;
      const trustedContext = await createAnalysisContext({ childId, page: requested.page, module: requested.module, dateFrom: requested.dateFrom, dateTo: requested.dateTo, filters: requested.filters });
      return reply.status(201).send({ conversation: await conversations.createConversation({ ...body, childId, context: trustedContext }) });
    }
    catch (error) { return reply.status(status(error)).send({ message: error instanceof Error ? error.message : '创建问答失败' }); }
  });
  const ask = async (request: any, reply: any) => {
    const body = request.body as { question?: string; providerId?: string; provider_id?: string };
    const childId = (body as any)?.childId ?? (body as any)?.child_id;
    const active = conversations.getActiveConversation(request.params.id);
    if (!childId) return reply.status(400).send({ message: 'child_id is required' });
    if (!active) return reply.status(404).send({ message: 'conversation not found' });
    if (active.context.childId !== childId) return reply.status(403).send({ message: '无权访问该孩子的问答' });
    try { return reply.send(await conversations.askConversation(request.params.id, body?.question ?? '', { providerId: body?.providerId ?? body?.provider_id })); }
    catch (error) { return reply.status(status(error)).send({ message: error instanceof Error ? error.message : '提问失败' }); }
  };
  app.post('/api/ai/conversations/:id/messages', ask);
  app.post('/api/ai/conversations/:id/questions', ask);
  app.post('/api/ai/conversations/:id/save', async (request, reply) => {
    const body = request.body as any;
    const childId = body?.childId ?? body?.child_id;
    const active = conversations.getActiveConversation((request.params as { id: string }).id);
    if (!childId) return reply.status(400).send({ message: 'child_id is required' });
    if (!active) return reply.status(404).send({ message: 'conversation not found' });
    if (active.context.childId !== childId) return reply.status(403).send({ message: '无权访问该孩子的问答' });
    try { return reply.status(201).send({ conversation: await conversations.saveConversation((request.params as { id: string }).id, body) }); }
    catch (error) { return reply.status(status(error)).send({ message: error instanceof Error ? error.message : '保存问答失败' }); }
  });
}
