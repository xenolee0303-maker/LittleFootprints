import type { FastifyInstance } from 'fastify';
import * as childrenService from '../services/children.js';

const idParamsSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] };

export async function childrenRoutes(app: FastifyInstance) {
  app.get('/api/children', async () => childrenService.listChildren());

  app.get('/api/children/:id', { config: {} }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const child = await childrenService.getChild(id);
    if (!child) return reply.status(404).send({ message: 'Not found' });
    return child;
  });

  app.post('/api/children', async (request, reply) => {
    const input = request.body as { name?: unknown } | null;
    if (typeof input?.name !== 'string' || input.name.trim().length === 0) {
      return reply.status(400).send({ message: 'name required' });
    }
    const child = await childrenService.createChild({ name: input.name });
    return reply.status(201).send(child);
  });

  app.patch('/api/children/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as { name?: unknown } | null;
    if (input && 'name' in input && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
      return reply.status(400).send({ message: 'name must be a non-empty string' });
    }
    const child = await childrenService.updateChild(id, input?.name !== undefined ? { name: input.name as string } : {});
    if (!child) return reply.status(404).send({ message: 'Not found' });
    return child;
  });

  app.delete('/api/children/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await childrenService.deleteChild(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
