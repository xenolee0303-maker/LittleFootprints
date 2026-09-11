import type { FastifyInstance } from 'fastify';
import * as journalService from '../services/journal.js';
import type { CreateDailyJournalInput, UpdateDailyJournalInput, JournalMood } from '@littlefootprints/shared';
import { childExists } from '../services/child-profile.js';
import {
  isPlainObject,
  hasOwn,
  isValidDate,
  isNonEmptyString,
  isNullableText,
  isOneOf,
  AUTHOR_ROLES,
} from './growth-validation.js';

const MOODS = ['great', 'good', 'normal', 'tired', 'sad'] as const;

function readMood(value: unknown): { error?: string; mood?: JournalMood | null } {
  if (value === undefined) return {};
  if (value === null || value === '') return { mood: null };
  if (!isOneOf(value, MOODS)) return { error: `mood must be one of ${MOODS.join(', ')}` };
  return { mood: value };
}

export async function journalRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/journal?from=&to=
  app.get('/api/children/:childId/journal', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    const query = request.query as { from?: string; to?: string };
    const range: { from?: string; to?: string } = {};
    if (query.from && isValidDate(query.from)) range.from = query.from;
    if (query.to && isValidDate(query.to)) range.to = query.to;
    return journalService.listJournal(childId, range);
  });

  // POST /api/children/:childId/journal
  app.post('/api/children/:childId/journal', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isValidDate(body.date)) {
      return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
    }
    if (!isNonEmptyString(body.content)) {
      return reply.status(400).send({ message: 'content required' });
    }
    if (!isOneOf(body.authorRole, AUTHOR_ROLES)) {
      return reply.status(400).send({ message: `authorRole must be one of ${AUTHOR_ROLES.join(', ')}` });
    }
    const input: CreateDailyJournalInput = {
      date: body.date,
      content: body.content.trim(),
      authorRole: body.authorRole,
    };
    if (hasOwn(body, 'mood')) {
      const parsed = readMood(body.mood);
      if (parsed.error) return reply.status(400).send({ message: parsed.error });
      if (parsed.mood !== undefined) input.mood = parsed.mood;
    }

    const entry = await journalService.createJournalEntry(childId, input);
    if (!entry) return reply.status(404).send({ message: 'Child not found' });
    return reply.status(201).send(entry);
  });

  // PATCH /api/journal/:id
  app.patch('/api/journal/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    const input: UpdateDailyJournalInput = {};
    if (hasOwn(body, 'date')) {
      if (!isValidDate(body.date)) {
        return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
      }
      input.date = body.date;
    }
    if (hasOwn(body, 'content')) {
      if (!isNonEmptyString(body.content)) {
        return reply.status(400).send({ message: 'content must be a non-empty string' });
      }
      input.content = body.content.trim();
    }
    if (hasOwn(body, 'mood')) {
      const parsed = readMood(body.mood);
      if (parsed.error) return reply.status(400).send({ message: parsed.error });
      if (parsed.mood !== undefined) input.mood = parsed.mood;
    }
    if (hasOwn(body, 'authorRole')) {
      if (!isOneOf(body.authorRole, AUTHOR_ROLES)) {
        return reply.status(400).send({ message: `authorRole must be one of ${AUTHOR_ROLES.join(', ')}` });
      }
      input.authorRole = body.authorRole;
    }

    const entry = await journalService.updateJournalEntry(id, input);
    if (!entry) return reply.status(404).send({ message: 'Not found' });
    return entry;
  });

  // DELETE /api/journal/:id
  app.delete('/api/journal/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await journalService.deleteJournalEntry(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
