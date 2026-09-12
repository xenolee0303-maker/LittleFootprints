import type { FastifyInstance } from 'fastify';
import {
  listVaccineRecords,
  createVaccineRecord,
  updateVaccineRecord,
  deleteVaccineRecord,
  markVaccineAdministered,
  generateFromTemplate,
} from '../services/vaccines.js';
import { childExists } from '../services/child-profile.js';
import type { CreateVaccineRecordInput, UpdateVaccineRecordInput } from '@littlefootprints/shared';
import {
  isPlainObject,
  hasOwn,
  isNonEmptyString,
  isNullableText,
  normalizeNullableText,
  isValidDate,
} from './growth-validation.js';

export async function vaccineRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/vaccines
  app.get('/api/children/:childId/vaccines', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    return listVaccineRecords(childId);
  });

  // POST /api/children/:childId/vaccines — manual entry
  app.post('/api/children/:childId/vaccines', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isNonEmptyString(body.name) || !isNonEmptyString(body.dose)) {
      return reply.status(400).send({ message: 'name and dose required' });
    }
    const input: CreateVaccineRecordInput = { name: body.name.trim(), dose: body.dose.trim() };
    for (const field of ['scheduledDate', 'administeredDate'] as const) {
      if (hasOwn(body, field)) {
        if (body[field] === null || body[field] === '') {
          input[field] = null;
        } else if (!isValidDate(body[field])) {
          return reply.status(400).send({ message: `${field} must be a real YYYY-MM-DD date` });
        } else {
          input[field] = body[field];
        }
      }
    }
    if (hasOwn(body, 'note')) {
      if (!isNullableText(body.note)) return reply.status(400).send({ message: 'note must be a string or null' });
      input.note = normalizeNullableText(body.note);
    }

    const record = await createVaccineRecord(childId, input);
    if (!record) return reply.status(404).send({ message: 'Child not found' });
    return reply.status(201).send(record);
  });

  // PATCH /api/vaccines/:id
  app.patch('/api/vaccines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    const input: UpdateVaccineRecordInput = {};
    if (hasOwn(body, 'name')) {
      if (!isNonEmptyString(body.name)) return reply.status(400).send({ message: 'name must be a non-empty string' });
      input.name = body.name.trim();
    }
    if (hasOwn(body, 'dose')) {
      if (!isNonEmptyString(body.dose)) return reply.status(400).send({ message: 'dose must be a non-empty string' });
      input.dose = body.dose.trim();
    }
    for (const field of ['scheduledDate', 'administeredDate'] as const) {
      if (hasOwn(body, field)) {
        if (body[field] === null || body[field] === '') {
          input[field] = null;
        } else if (!isValidDate(body[field])) {
          return reply.status(400).send({ message: `${field} must be a real YYYY-MM-DD date` });
        } else {
          input[field] = body[field];
        }
      }
    }
    if (hasOwn(body, 'note')) {
      if (!isNullableText(body.note)) return reply.status(400).send({ message: 'note must be a string or null' });
      input.note = normalizeNullableText(body.note);
    }

    const record = await updateVaccineRecord(id, input);
    if (!record) return reply.status(404).send({ message: 'Not found' });
    return record;
  });

  // POST /api/vaccines/:id/administer — mark as done
  app.post('/api/vaccines/:id/administer', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { date?: unknown };
    const date = typeof body.date === 'string' && isValidDate(body.date) ? body.date : new Date().toISOString().slice(0, 10);
    const record = await markVaccineAdministered(id, date);
    if (!record) return reply.status(404).send({ message: 'Not found' });
    return record;
  });

  // DELETE /api/vaccines/:id
  app.delete('/api/vaccines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteVaccineRecord(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });

  // POST /api/children/:childId/vaccines/generate — from immunization template
  app.post('/api/children/:childId/vaccines/generate', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const result = await generateFromTemplate(childId);
    if (!result) return reply.status(404).send({ message: 'Child not found' });
    if (result.skipped) {
      return reply.status(400).send({ message: '请先在「档案」里填写孩子的出生日期，才能推算应种日期' });
    }
    return { created: result.created };
  });
}
