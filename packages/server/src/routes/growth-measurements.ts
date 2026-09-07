import type { FastifyInstance } from 'fastify';
import * as measurementService from '../services/growth-measurements.js';
import { childExists } from '../services/child-profile.js';
import type { CreateGrowthMeasurementInput, UpdateGrowthMeasurementInput } from '@bloommate/shared';
import {
  isPlainObject,
  hasOwn,
  isValidDate,
  isNullableText,
  normalizeNullableText,
  isPositiveNumber,
} from './growth-validation.js';

function readMeasurementFields(
  body: Record<string, unknown>,
  message: string,
): { error: string } | CreateGrowthMeasurementInput {
  const input: CreateGrowthMeasurementInput = { date: '' };

  if (!isValidDate(body.date)) return { error: `${message}: date must be a real YYYY-MM-DD date` };
  input.date = body.date;

  for (const field of ['heightCm', 'weightKg'] as const) {
    if (hasOwn(body, field)) {
      const value = body[field];
      if (value === null || value === '' || value === undefined) continue;
      if (!isPositiveNumber(value)) return { error: `${message}: ${field} must be a positive number` };
      input[field] = value;
    }
  }

  if (hasOwn(body, 'note')) {
    if (!isNullableText(body.note)) return { error: `${message}: note must be a string or null` };
    input.note = normalizeNullableText(body.note);
  }

  if (input.heightCm === undefined && input.weightKg === undefined) {
    return { error: `${message}: at least one of heightCm or weightKg is required` };
  }
  return input;
}

export async function growthMeasurementRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/measurements
  app.get('/api/children/:childId/measurements', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    return measurementService.listMeasurements(childId);
  });

  // POST /api/children/:childId/measurements
  app.post('/api/children/:childId/measurements', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    const parsed = readMeasurementFields(body, 'invalid measurement');
    if ('error' in parsed) return reply.status(400).send({ message: parsed.error });

    const measurement = await measurementService.createMeasurement(childId, parsed);
    if (!measurement) return reply.status(404).send({ message: 'Child not found' });
    return reply.status(201).send(measurement);
  });

  // PATCH /api/measurements/:id
  app.patch('/api/measurements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }

    const existing = await measurementService.getMeasurement(id);
    if (!existing) return reply.status(404).send({ message: 'Not found' });

    const input: UpdateGrowthMeasurementInput = {};
    if (hasOwn(body, 'date')) {
      if (!isValidDate(body.date)) {
        return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
      }
      input.date = body.date;
    }
    for (const field of ['heightCm', 'weightKg'] as const) {
      if (hasOwn(body, field)) {
        const value = body[field];
        if (value === null || value === '') {
          input[field] = null;
        } else if (!isPositiveNumber(value)) {
          return reply.status(400).send({ message: `${field} must be a positive number` });
        } else {
          input[field] = value;
        }
      }
    }
    if (hasOwn(body, 'note')) {
      if (!isNullableText(body.note)) {
        return reply.status(400).send({ message: 'note must be a string or null' });
      }
      input.note = normalizeNullableText(body.note);
    }

    const nextHeight = input.heightCm !== undefined ? input.heightCm : existing.heightCm;
    const nextWeight = input.weightKg !== undefined ? input.weightKg : existing.weightKg;
    if (nextHeight === null && nextWeight === null) {
      return reply.status(400).send({ message: 'at least one of heightCm or weightKg is required' });
    }

    const measurement = await measurementService.updateMeasurement(id, input);
    if (!measurement) return reply.status(404).send({ message: 'Not found' });
    return measurement;
  });

  // DELETE /api/measurements/:id
  app.delete('/api/measurements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await measurementService.deleteMeasurement(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
