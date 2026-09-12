import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  getBridgeStatus,
  saveBridgeConfig,
  testBridgeConnection,
  listKidStudyChildren,
  getChildIntegration,
  setChildIntegration,
  clearChildIntegration,
  fetchLearningSummary,
  BridgeError,
} from '../services/kidstudy-bridge.js';
import { childExists } from '../services/child-profile.js';
import { isValidDate, isNonEmptyString } from './growth-validation.js';

function sendBridgeError(reply: FastifyReply, error: unknown) {
  if (error instanceof BridgeError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'integration error' });
}

export async function integrationRoutes(app: FastifyInstance) {
  // GET /api/integrations/kidstudy — status
  app.get('/api/integrations/kidstudy', async () => getBridgeStatus());

  // PUT /api/integrations/kidstudy — save base URL (+ optional new PIN)
  app.put('/api/integrations/kidstudy', async (request, reply) => {
    const body = request.body as { baseUrl?: unknown; pin?: unknown } | null;
    if (!isNonEmptyString(body?.baseUrl)) {
      return reply.status(400).send({ message: 'baseUrl required' });
    }
    if (!/^https?:\/\//i.test(body.baseUrl.trim())) {
      return reply.status(400).send({ message: 'baseUrl must be an http(s) URL' });
    }
    if (body.pin !== undefined && body.pin !== '' && !/^\d{6}$/.test(String(body.pin))) {
      return reply.status(400).send({ message: 'PIN must be exactly 6 digits' });
    }
    await saveBridgeConfig(body.baseUrl, body.pin === undefined ? undefined : String(body.pin));
    return getBridgeStatus();
  });

  // POST /api/integrations/kidstudy/test — verify connectivity
  app.post('/api/integrations/kidstudy/test', async (request, reply) => {
    const result = await testBridgeConnection();
    if (!result.ok) return reply.status(502).send({ message: result.message });
    return { ok: true, children: result.children };
  });

  // GET /api/integrations/kidstudy/children — kid-study children for mapping
  app.get('/api/integrations/kidstudy/children', async (request, reply) => {
    try {
      return await listKidStudyChildren();
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  // GET /api/children/:childId/integration — mapping
  app.get('/api/children/:childId/integration', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    return getChildIntegration(childId);
  });

  // PUT /api/children/:childId/integration — set mapping
  app.put('/api/children/:childId/integration', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body as { kidstudyChildId?: unknown; kidstudyChildName?: unknown } | null;
    if (!isNonEmptyString(body?.kidstudyChildId) || !isNonEmptyString(body?.kidstudyChildName)) {
      return reply.status(400).send({ message: 'kidstudyChildId and kidstudyChildName required' });
    }
    const mapping = await setChildIntegration(childId, body.kidstudyChildId.trim(), body.kidstudyChildName.trim());
    if (!mapping) return reply.status(404).send({ message: 'Child not found' });
    return mapping;
  });

  // DELETE /api/children/:childId/integration — remove mapping
  app.delete('/api/children/:childId/integration', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const deleted = await clearChildIntegration(childId);
    return { success: deleted };
  });

  // GET /api/children/:childId/learning/summary?week_start= — on-demand pull
  app.get('/api/children/:childId/learning/summary', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const query = request.query as { week_start?: string };
    const weekStart = query.week_start && isValidDate(query.week_start) ? query.week_start : undefined;
    return fetchLearningSummary(childId, weekStart ?? mondayOfToday());
  });
}

function mondayOfToday(): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
