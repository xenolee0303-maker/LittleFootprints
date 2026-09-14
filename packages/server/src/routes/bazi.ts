import type { FastifyInstance } from 'fastify';
import { computeBazi } from '../services/bazi.js';
import { getProfile, childExists } from '../services/child-profile.js';

export async function baziRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/bazi — computed birth-chart facts (calendar math)
  app.get('/api/children/:childId/bazi', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const profile = await getProfile(childId);
    return computeBazi({ birthDate: profile?.birthDate ?? null, birthTime: profile?.birthTime ?? null });
  });
}
