import type { FastifyInstance } from 'fastify';
import * as profileService from '../services/child-profile.js';
import { listChildSummaries } from '../services/ai-reports.js';
import type { UpsertChildProfileInput } from '@littlefootprints/shared';
import {
  isPlainObject,
  hasOwn,
  isNullableText,
  normalizeNullableText,
  isValidDate,
} from './growth-validation.js';

const PROFILE_TEXT_FIELDS = ['schoolStage', 'personality', 'aiBackground'] as const;

export async function childProfileRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/child-summaries — child-safe weekly report highlights
  app.get('/api/children/:childId/child-summaries', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await profileService.childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const query = request.query as { limit?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 52 ? parsedLimit : 8;
    return { summaries: await listChildSummaries(childId, limit) };
  });

  // GET /api/children/:childId/profile
  app.get('/api/children/:childId/profile', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await profileService.childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const profile = await profileService.getProfile(childId);
    return profile ?? { childId, birthDate: null, schoolStage: null, personality: null, aiBackground: null, createdAt: '', updatedAt: '' };
  });

  // PUT /api/children/:childId/profile — full save (upsert)
  app.put('/api/children/:childId/profile', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const input = request.body;
    if (!isPlainObject(input)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }

    const input_: UpsertChildProfileInput = {};

    if (hasOwn(input, 'birthDate')) {
      if (input.birthDate === null || input.birthDate === '') {
        input_.birthDate = null;
      } else if (!isValidDate(input.birthDate)) {
        return reply.status(400).send({ message: 'birthDate must be a real YYYY-MM-DD date' });
      } else {
        input_.birthDate = input.birthDate;
      }
    }

    for (const field of PROFILE_TEXT_FIELDS) {
      if (hasOwn(input, field)) {
        if (!isNullableText(input[field])) {
          return reply.status(400).send({ message: `${field} must be a string or null` });
        }
        input_[field] = normalizeNullableText(input[field]);
      }
    }

    const profile = await profileService.upsertProfile(childId, input_);
    if (!profile) return reply.status(404).send({ message: 'Child not found' });
    return profile;
  });
}
