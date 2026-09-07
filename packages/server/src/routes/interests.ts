import type { FastifyInstance } from 'fastify';
import * as interestsService from '../services/interests.js';
import { childExists } from '../services/child-profile.js';
import type { CreateInterestInput, UpdateInterestInput, CreateInterestNoteInput, UpdateInterestNoteInput } from '@bloommate/shared';
import {
  isPlainObject,
  hasOwn,
  isNonEmptyString,
  isNullableText,
  normalizeNullableText,
  isValidDate,
  isOneOf,
  INTEREST_CATEGORIES,
  INTEREST_STATUSES,
  INTEREST_NOTE_TYPES,
  AUTHOR_ROLES,
} from './growth-validation.js';

export async function interestRoutes(app: FastifyInstance) {
  // GET /api/children/:childId/interests
  app.get('/api/children/:childId/interests', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    if (!(await childExists(childId))) {
      return reply.status(404).send({ message: 'Child not found' });
    }
    return interestsService.listInterests(childId);
  });

  // POST /api/children/:childId/interests
  app.post('/api/children/:childId/interests', async (request, reply) => {
    const { childId } = request.params as { childId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isNonEmptyString(body.name)) {
      return reply.status(400).send({ message: 'name required' });
    }
    if (!isOneOf(body.category, INTEREST_CATEGORIES)) {
      return reply.status(400).send({ message: `category must be one of ${INTEREST_CATEGORIES.join(', ')}` });
    }
    if (!isValidDate(body.startedAt)) {
      return reply.status(400).send({ message: 'startedAt must be a real YYYY-MM-DD date' });
    }
    const input: CreateInterestInput = {
      name: body.name.trim(),
      category: body.category,
      startedAt: body.startedAt,
    };
    if (hasOwn(body, 'status')) {
      if (!isOneOf(body.status, INTEREST_STATUSES)) {
        return reply.status(400).send({ message: `status must be one of ${INTEREST_STATUSES.join(', ')}` });
      }
      input.status = body.status;
    }
    if (hasOwn(body, 'endedAt')) {
      if (body.endedAt === null || body.endedAt === '') {
        input.endedAt = null;
      } else if (!isValidDate(body.endedAt)) {
        return reply.status(400).send({ message: 'endedAt must be a real YYYY-MM-DD date' });
      } else {
        input.endedAt = body.endedAt;
      }
    }
    if (hasOwn(body, 'description')) {
      if (!isNullableText(body.description)) {
        return reply.status(400).send({ message: 'description must be a string or null' });
      }
      input.description = normalizeNullableText(body.description);
    }

    const interest = await interestsService.createInterest(childId, input);
    if (!interest) return reply.status(404).send({ message: 'Child not found' });
    return reply.status(201).send(interest);
  });

  // PATCH /api/interests/:id
  app.patch('/api/interests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (hasOwn(body, 'childId')) {
      return reply.status(400).send({ message: 'childId cannot be changed' });
    }

    const input: UpdateInterestInput = {};
    if (hasOwn(body, 'name')) {
      if (!isNonEmptyString(body.name)) return reply.status(400).send({ message: 'name must be a non-empty string' });
      input.name = body.name.trim();
    }
    if (hasOwn(body, 'category')) {
      if (!isOneOf(body.category, INTEREST_CATEGORIES)) {
        return reply.status(400).send({ message: `category must be one of ${INTEREST_CATEGORIES.join(', ')}` });
      }
      input.category = body.category;
    }
    if (hasOwn(body, 'status')) {
      if (!isOneOf(body.status, INTEREST_STATUSES)) {
        return reply.status(400).send({ message: `status must be one of ${INTEREST_STATUSES.join(', ')}` });
      }
      input.status = body.status;
    }
    if (hasOwn(body, 'startedAt')) {
      if (!isValidDate(body.startedAt)) {
        return reply.status(400).send({ message: 'startedAt must be a real YYYY-MM-DD date' });
      }
      input.startedAt = body.startedAt;
    }
    if (hasOwn(body, 'endedAt')) {
      if (body.endedAt === null || body.endedAt === '') {
        input.endedAt = null;
      } else if (!isValidDate(body.endedAt)) {
        return reply.status(400).send({ message: 'endedAt must be a real YYYY-MM-DD date' });
      } else {
        input.endedAt = body.endedAt;
      }
    }
    if (hasOwn(body, 'description')) {
      if (!isNullableText(body.description)) {
        return reply.status(400).send({ message: 'description must be a string or null' });
      }
      input.description = normalizeNullableText(body.description);
    }

    const interest = await interestsService.updateInterest(id, input);
    if (!interest) return reply.status(404).send({ message: 'Not found' });
    return interest;
  });

  // DELETE /api/interests/:id — cascades notes
  app.delete('/api/interests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await interestsService.deleteInterest(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });

  // GET /api/interests/:interestId/notes
  app.get('/api/interests/:interestId/notes', async (request, reply) => {
    const { interestId } = request.params as { interestId: string };
    const notes = await interestsService.listNotes(interestId);
    if (!notes) return reply.status(404).send({ message: 'Interest not found' });
    return notes;
  });

  // POST /api/interests/:interestId/notes
  app.post('/api/interests/:interestId/notes', async (request, reply) => {
    const { interestId } = request.params as { interestId: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isValidDate(body.date)) {
      return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
    }
    if (!isOneOf(body.type, INTEREST_NOTE_TYPES)) {
      return reply.status(400).send({ message: `type must be one of ${INTEREST_NOTE_TYPES.join(', ')}` });
    }
    if (!isNonEmptyString(body.content)) {
      return reply.status(400).send({ message: 'content required' });
    }
    if (!isOneOf(body.authorRole, AUTHOR_ROLES)) {
      return reply.status(400).send({ message: `authorRole must be one of ${AUTHOR_ROLES.join(', ')}` });
    }
    const input: CreateInterestNoteInput = {
      date: body.date,
      type: body.type,
      content: body.content.trim(),
      authorRole: body.authorRole,
    };

    const note = await interestsService.createNote(interestId, input);
    if (!note) return reply.status(404).send({ message: 'Interest not found' });
    return reply.status(201).send(note);
  });

  // PATCH /api/interest-notes/:id
  app.patch('/api/interest-notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }

    const input: UpdateInterestNoteInput = {};
    if (hasOwn(body, 'date')) {
      if (!isValidDate(body.date)) {
        return reply.status(400).send({ message: 'date must be a real YYYY-MM-DD date' });
      }
      input.date = body.date;
    }
    if (hasOwn(body, 'type')) {
      if (!isOneOf(body.type, INTEREST_NOTE_TYPES)) {
        return reply.status(400).send({ message: `type must be one of ${INTEREST_NOTE_TYPES.join(', ')}` });
      }
      input.type = body.type;
    }
    if (hasOwn(body, 'content')) {
      if (!isNonEmptyString(body.content)) {
        return reply.status(400).send({ message: 'content must be a non-empty string' });
      }
      input.content = body.content.trim();
    }
    if (hasOwn(body, 'authorRole')) {
      if (!isOneOf(body.authorRole, AUTHOR_ROLES)) {
        return reply.status(400).send({ message: `authorRole must be one of ${AUTHOR_ROLES.join(', ')}` });
      }
      input.authorRole = body.authorRole;
    }

    const note = await interestsService.updateNote(id, input);
    if (!note) return reply.status(404).send({ message: 'Not found' });
    return note;
  });

  // DELETE /api/interest-notes/:id
  app.delete('/api/interest-notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await interestsService.deleteNote(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
