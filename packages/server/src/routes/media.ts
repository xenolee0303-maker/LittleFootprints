import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  getMediaStatus,
  listMediaDirectories,
  listMediaItems,
  generateThumbnail,
  resolveMediaPath,
  MediaError,
} from '../services/media-library.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function sendMediaError(reply: FastifyReply, error: unknown) {
  if (error instanceof MediaError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'media library error' });
}

export async function mediaRoutes(app: FastifyInstance) {
  // GET /api/media/status — whether the library is configured
  app.get('/api/media/status', async () => {
    return getMediaStatus();
  });

  // GET /api/media/directories?search=
  app.get('/api/media/directories', async (request, reply) => {
    const query = request.query as { search?: string };
    try {
      return await listMediaDirectories(query.search);
    } catch (error) {
      return sendMediaError(reply, error);
    }
  });

  // GET /api/media/items?path=
  app.get('/api/media/items', async (request, reply) => {
    const query = request.query as { path?: string };
    try {
      return await listMediaItems(query.path ?? '');
    } catch (error) {
      return sendMediaError(reply, error);
    }
  });

  // GET /api/media/thumb?path= — generated WebP thumbnail with immutable caching
  app.get('/api/media/thumb', async (request, reply) => {
    const query = request.query as { path?: string };
    try {
      const absolute = await resolveMediaPath(query.path ?? '', 'file');
      const result = await generateThumbnail(absolute);
      if (!result) return reply.status(404).send({ message: 'unsupported media type' });
      if ('placeholder' in result) {
        return reply.status(415).send({ message: 'no thumbnail available for this file' });
      }
      reply.header('Content-Type', 'image/webp');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(result.body);
    } catch (error) {
      return sendMediaError(reply, error);
    }
  });

  // GET /api/media/original?path= — stream original image/video (supports Range for video seeking)
  app.get('/api/media/original', async (request, reply) => {
    const query = request.query as { path?: string };
    try {
      const absolute = await resolveMediaPath(query.path ?? '', 'file');
      const { stat } = await import('node:fs/promises');
      const { createReadStream } = await import('node:fs');
      const info = await stat(absolute);
      reply.header('Content-Type', contentTypeFor(absolute));
      reply.header('Accept-Ranges', 'bytes');
      // Files are immutable inside the read-only library: let the browser cache for a day.
      reply.header('Cache-Control', `public, max-age=${DAY_MS / 1000}`);

      const rangeHeader = request.headers.range;
      const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
      if (match) {
        const start = match[1] === '' ? undefined : Number(match[1]);
        const end = match[2] === '' ? undefined : Number(match[2]);
        if (
          (start === undefined && end === undefined)
          || (start !== undefined && Number.isNaN(start))
          || (start !== undefined && start >= info.size)
        ) {
          reply.status(416).header('Content-Range', `bytes */${info.size}`);
          return reply.send();
        }
        const resolvedStart = start ?? Math.max(0, info.size - (end ?? 0));
        const resolvedEnd = Math.min(end ?? info.size - 1, info.size - 1);
        reply.status(206);
        reply.header('Content-Range', `bytes ${resolvedStart}-${resolvedEnd}/${info.size}`);
        reply.header('Content-Length', resolvedEnd - resolvedStart + 1);
        return reply.send(createReadStream(absolute, { start: resolvedStart, end: resolvedEnd }));
      }

      reply.header('Content-Length', info.size);
      return reply.send(createReadStream(absolute));
    } catch (error) {
      return sendMediaError(reply, error);
    }
  });
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.3gp': 'video/3gpp',
};

function contentTypeFor(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
