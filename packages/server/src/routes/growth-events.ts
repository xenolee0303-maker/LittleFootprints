import type { FastifyInstance } from 'fastify';
import * as eventsService from '../services/growth-events.js';
import type { CreateGrowthEventInput, UpdateGrowthEventInput } from '@bloommate/shared';
import {
  isPlainObject,
  hasOwn,
  isNonEmptyString,
  isNullableText,
  normalizeNullableText,
  isValidDate,
  isOneOf,
  GROWTH_EVENT_TYPES,
  AUTHOR_ROLES,
} from './growth-validation.js';
import { directoryExistsInLibrary, getMediaStatus } from '../services/media-library.js';

function readParticipantChildIds(
  body: Record<string, unknown>,
): { error: string } | { participantChildIds: string[] } {
  const value = body.participantChildIds;
  if (!Array.isArray(value) || value.length === 0 || !value.every((id) => isNonEmptyString(id))) {
    return { error: 'participantChildIds must be a non-empty array of child ids' };
  }
  return { participantChildIds: (value as string[]).map((id) => id.trim()) };
}

// Optional fields shared by create and update. Only fields present in the body are set.
function readOptionalEventFields(
  body: Record<string, unknown>,
  input: UpdateGrowthEventInput,
): string | null {
  if (hasOwn(body, 'endDate')) {
    if (body.endDate === null || body.endDate === '') {
      input.endDate = null;
    } else if (!isValidDate(body.endDate)) {
      return 'endDate must be a real YYYY-MM-DD date';
    } else {
      input.endDate = body.endDate;
    }
  }
  if (hasOwn(body, 'location')) {
    if (!isNullableText(body.location)) return 'location must be a string or null';
    input.location = normalizeNullableText(body.location);
  }
  if (hasOwn(body, 'description')) {
    if (!isNullableText(body.description)) return 'description must be a string or null';
    input.description = normalizeNullableText(body.description);
  }
  if (hasOwn(body, 'authorRole')) {
    if (!isOneOf(body.authorRole, AUTHOR_ROLES)) {
      return `authorRole must be one of ${AUTHOR_ROLES.join(', ')}`;
    }
    input.authorRole = body.authorRole;
  }
  if (hasOwn(body, 'mediaDirectory')) {
    if (body.mediaDirectory === null || body.mediaDirectory === '') {
      input.mediaDirectory = null;
    } else if (isNonEmptyString(body.mediaDirectory)) {
      input.mediaDirectory = body.mediaDirectory.trim();
    } else {
      return 'mediaDirectory must be a string or null';
    }
  }
  return null;
}

async function mediaDirectoryError(input: { mediaDirectory?: string | null }): Promise<string | null> {
  if (input.mediaDirectory === undefined || input.mediaDirectory === null) return null;
  const status = await getMediaStatus();
  if (!status.configured) return '媒体库未配置，无法关联相册目录';
  if (!(await directoryExistsInLibrary(input.mediaDirectory))) {
    return `相册目录不存在：${input.mediaDirectory}`;
  }
  return null;
}

export async function growthEventRoutes(app: FastifyInstance) {
  // GET /api/growth-events?childId=...
  app.get('/api/growth-events', async (request) => {
    const query = request.query as { childId?: string };
    return eventsService.listEvents(query.childId?.trim() || undefined);
  });

  // POST /api/growth-events
  app.post('/api/growth-events', async (request, reply) => {
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }
    if (!isOneOf(body.type, GROWTH_EVENT_TYPES)) {
      return reply.status(400).send({ message: `type must be one of ${GROWTH_EVENT_TYPES.join(', ')}` });
    }
    if (!isNonEmptyString(body.title)) {
      return reply.status(400).send({ message: 'title required' });
    }
    if (!isValidDate(body.startDate)) {
      return reply.status(400).send({ message: 'startDate must be a real YYYY-MM-DD date' });
    }
    const parsedParticipants = readParticipantChildIds(body);
    if ('error' in parsedParticipants) {
      return reply.status(400).send({ message: parsedParticipants.error });
    }

    const input: CreateGrowthEventInput = {
      type: body.type,
      title: body.title.trim(),
      startDate: body.startDate,
      participantChildIds: parsedParticipants.participantChildIds,
    };
    const optionalError = readOptionalEventFields(body, input);
    if (optionalError) return reply.status(400).send({ message: optionalError });

    if (input.endDate !== null && input.endDate !== undefined && input.endDate < input.startDate) {
      return reply.status(400).send({ message: 'endDate must not be earlier than startDate' });
    }

    const mediaError = await mediaDirectoryError(input);
    if (mediaError) return reply.status(400).send({ message: mediaError });

    const event = await eventsService.createEvent(input);
    if (!event) return reply.status(400).send({ message: 'participantChildIds contains an unknown child' });
    return reply.status(201).send(event);
  });

  // PATCH /api/growth-events/:id
  app.patch('/api/growth-events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isPlainObject(body)) {
      return reply.status(400).send({ message: 'body must be an object' });
    }

    const input: UpdateGrowthEventInput = {};
    if (hasOwn(body, 'type')) {
      if (!isOneOf(body.type, GROWTH_EVENT_TYPES)) {
        return reply.status(400).send({ message: `type must be one of ${GROWTH_EVENT_TYPES.join(', ')}` });
      }
      input.type = body.type;
    }
    if (hasOwn(body, 'title')) {
      if (!isNonEmptyString(body.title)) {
        return reply.status(400).send({ message: 'title must be a non-empty string' });
      }
      input.title = body.title.trim();
    }
    if (hasOwn(body, 'startDate')) {
      if (!isValidDate(body.startDate)) {
        return reply.status(400).send({ message: 'startDate must be a real YYYY-MM-DD date' });
      }
      input.startDate = body.startDate;
    }
    if (hasOwn(body, 'participantChildIds')) {
      const parsed = readParticipantChildIds(body);
      if ('error' in parsed) return reply.status(400).send({ message: parsed.error });
      input.participantChildIds = parsed.participantChildIds;
    }
    const optionalError = readOptionalEventFields(body, input);
    if (optionalError) return reply.status(400).send({ message: optionalError });

    const existing = await eventsService.getEvent(id);
    if (!existing) return reply.status(404).send({ message: 'Not found' });

    const nextStart = input.startDate ?? existing.startDate;
    const nextEnd = input.endDate !== undefined ? input.endDate : existing.endDate;
    if (nextEnd !== null && nextEnd < nextStart) {
      return reply.status(400).send({ message: 'endDate must not be earlier than startDate' });
    }

    const mediaError = await mediaDirectoryError(input);
    if (mediaError) return reply.status(400).send({ message: mediaError });

    const event = await eventsService.updateEvent(id, input);
    if (!event) return reply.status(404).send({ message: 'Not found' });
    return event;
  });

  // DELETE /api/growth-events/:id
  app.delete('/api/growth-events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await eventsService.deleteEvent(id);
    if (!deleted) return reply.status(404).send({ message: 'Not found' });
    return { success: true };
  });
}
