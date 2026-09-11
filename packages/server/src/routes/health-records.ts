import type { FastifyInstance, FastifyReply } from 'fastify';
import * as healthService from '../services/health.js';
import { childExists } from '../services/child-profile.js';
import type { CreateHealthRecordInput, UpdateHealthRecordInput, HealthRecordType } from '@littlefootprints/shared';
import {
  isPlainObject,
  hasOwn,
  isValidDate,
  isNonEmptyString,
  isNullableText,
  normalizeNullableText,
  isOneOf,
} from './growth-validation.js';

const RECORD_TYPES = ['checkup', 'illness', 'vaccination', 'other'] as const;

function sendError(reply: FastifyReply, error: unknown) {
  return reply.status(500).send({ message: 'health service error' });
}

export async function healthRecordRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/health/profile
  app.get('/api/children/:childId/health/profile', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const profile = await healthService.getHealthProfile(childId);
    return profile ?? { childId, allergies: null, chronicConditions: null, notes: null, createdAt: '', updatedAt: '' };
  });

  // PUT /api/children/:childId/health/profile
  app.put('/api/children/:childId/health/profile', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    const input: Record<string, string | null> = {};
    for (const field of ['allergies', 'chronicConditions', 'notes'] as const) {
      if (hasOwn(body, field)) {
        if (!isNullableText(body[field])) {
          return reply.status(400).send({ message: `${field} must be a string or null` });
        }
        input[field] = normalizeNullableText(body[field]);
      }
    }
    const profile = await healthService.upsertHealthProfile(childId, input);
    if (!profile) return reply.status(404).send({ message: 'Child not found' });
    return profile;
  });

  // GET /api/children/:childId/health/records?from=&to=
  app.get('/api/children/:childId/health/records', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const query = request.query as { from?: string; to?: string };
    const range: { from?: string; to?: string } = {};
    if (query.from && isValidDate(query.from)) range.from = query.from;
    if (query.to && isValidDate(query.to)) range.to = query.to;
    return healthService.listHealthRecords(childId, range);
  });

  // POST /api/children/:childId/health/records
  app.post('/api/children/:childId/health/records', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isValidDate(body.date)) {
      return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
    }
    if (!isOneOf(body.type, RECORD_TYPES)) {
      return reply.status(400).send({ message: `type must be one of ${RECORD_TYPES.join(', ')}` });
    }
    if (!isNonEmptyString(body.title)) {
      return reply.status(400).send({ message: 'title required' });
    }
    const input: CreateHealthRecordInput = {
      date: body.date,
      type: body.type as HealthRecordType,
      title: body.title.trim(),
    };
    for (const field of ['facility', 'summary'] as const) {
      if (hasOwn(body, field)) {
        if (!isNullableText(body[field])) {
          return reply.status(400).send({ message: `${field} must be a string or null` });
        }
        input[field] = normalizeNullableText(body[field]);
      }
    }
    if (hasOwn(body, 'followUpDate')) {
      if (body.followUpDate === null || body.followUpDate === '') {
        input.followUpDate = null;
      } else if (!isValidDate(body.followUpDate)) {
        return reply.status(400).send({ message: 'followUpDate must be a real YYYY-MM-DD date' });
      } else {
        input.followUpDate = body.followUpDate;
      }
    }

    const record = await healthService.createHealthRecord(childId, input);
    if (!record) return reply.status(404).send({ message: 'Child not found' });
    return reply.status(201).send(record);
  });

  // PATCH /api/health-records/:id
  app.patch('/api/health-records/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    const input: UpdateHealthRecordInput = {};
    if (hasOwn(body, 'date')) {
      if (!isValidDate(body.date)) return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
      input.date = body.date;
    }
    if (hasOwn(body, 'type')) {
      if (!isOneOf(body.type, RECORD_TYPES)) return reply.status(400).send({ message: `type must be one of ${RECORD_TYPES.join(', ')}` });
      input.type = body.type;
    }
    if (hasOwn(body, 'title')) {
      if (!isNonEmptyString(body.title)) return reply.status(400).send({ message: 'title must be a non-empty string' });
      input.title = body.title.trim();
    }
    for (const field of ['facility', 'summary'] as const) {
      if (hasOwn(body, field)) {
        if (!isNullableText(body[field])) return reply.status(400).send({ message: `${field} must be a string or null` });
        input[field] = normalizeNullableText(body[field]);
      }
    }
    if (hasOwn(body, 'followUpDate')) {
      if (body.followUpDate === null || body.followUpDate === '') {
        input.followUpDate = null;
      } else if (!isValidDate(body.followUpDate)) {
        return reply.status(400).send({ message: 'followUpDate must be a real YYYY-MM-DD date' });
      } else {
        input.followUpDate = body.followUpDate;
      }
    }

    const record = await healthService.updateHealthRecord(id, input);
    if (!record) return reply.status(404).send({ message: 'Not found' });
    return record;
  });

  // DELETE /api/health-records/:id
  app.delete('/api/health-records/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await healthService.deleteHealthRecord(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
