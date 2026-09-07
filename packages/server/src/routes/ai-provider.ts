import type { FastifyInstance } from 'fastify';
import * as service from '../services/ai-provider-config.js';

export async function aiProviderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/ai/providers', async () => ({ providers: await service.list() }));
  app.get('/api/ai/providers/:id', async (request, reply) => {
    const config = await service.get((request.params as { id: string }).id);
    return config ? { config } : reply.status(404).send({ message: 'Not found' });
  });
  app.post('/api/ai/providers', async (request, reply) => {
    try { return reply.status(201).send({ config: await service.create(request.body as any) }); }
    catch (error) { return reply.status(400).send({ message: error instanceof Error ? error.message : 'Invalid provider config' }); }
  });
  app.patch('/api/ai/providers/:id', async (request, reply) => {
    try { const config = await service.update((request.params as { id: string }).id, request.body as any); return config ? { config } : reply.status(404).send({ message: 'Not found' }); }
    catch (error) { return reply.status(400).send({ message: error instanceof Error ? error.message : 'Invalid provider config' }); }
  });
  app.delete('/api/ai/providers/:id', async (request, reply) => {
    const removed = await service.remove((request.params as { id: string }).id); return removed ? { success: true } : reply.status(404).send({ message: 'Not found' });
  });
  app.post('/api/ai/providers/:id/test', async (request, reply) => {
    try { return { result: await service.testConnection((request.params as { id: string }).id) }; }
    catch (error) { return reply.status(502).send({ message: error instanceof Error ? error.message : 'Provider unavailable' }); }
  });
  // Singular aliases keep the endpoint ergonomic for settings clients.
  app.get('/api/ai/provider', async () => ({ providers: await service.list() }));
}
