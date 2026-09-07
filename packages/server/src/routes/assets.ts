import type { FastifyInstance, FastifyReply } from 'fastify';
import { getNote } from '../services/interests.js';
import {
  attachAsset,
  getAsset,
  deleteAsset,
  sendAssetFile,
  sendAssetThumb,
  AssetError,
} from '../services/media-assets.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function sendAssetError(reply: FastifyReply, error: unknown) {
  if (error instanceof AssetError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'asset error' });
}

export async function assetRoutes(app: FastifyInstance) {
  // POST /api/interest-notes/:noteId/assets — multipart upload (single file)
  app.post('/api/interest-notes/:noteId/assets', async (request, reply) => {
    const { noteId } = request.params as { noteId: string };
    try {
      if (!(await getNote(noteId))) {
        return reply.status(404).send({ message: '进展记录不存在' });
      }
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ message: '缺少文件' });
      }
      const maxBytes = Math.max(1, Number(process.env.MAX_ASSET_SIZE_MB ?? 200)) * 1024 * 1024;
      const buffer = await file.toBuffer();
      if (buffer.byteLength === 0) {
        return reply.status(400).send({ message: '文件为空' });
      }
      if (buffer.byteLength > maxBytes) {
        return reply.status(413).send({ message: `文件超过大小限制（${Math.round(maxBytes / 1024 / 1024)}MB）` });
      }
      const asset = await attachAsset(noteId, file.filename, buffer);
      return reply.status(201).send(asset);
    } catch (error) {
      return sendAssetError(reply, error);
    }
  });

  // GET /api/assets/:id — stream original (Range supported for video)
  app.get('/api/assets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const asset = await getAsset(id);
      if (!asset) return reply.status(404).send({ message: '附件不存在' });
      return sendAssetFile(request, reply, asset.absolutePath, asset.row.fileName);
    } catch (error) {
      return sendAssetError(reply, error);
    }
  });

  // GET /api/assets/:id/thumb — WebP thumbnail (placeholder formats → 415)
  app.get('/api/assets/:id/thumb', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const asset = await getAsset(id);
      if (!asset) return reply.status(404).send({ message: '附件不存在' });
      return sendAssetThumb(reply, asset.absolutePath, asset.row.fileName);
    } catch (error) {
      return sendAssetError(reply, error);
    }
  });

  // DELETE /api/assets/:id
  app.delete('/api/assets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await deleteAsset(id);
      if (!deleted) return reply.status(404).send({ message: '附件不存在' });
      return { success: true };
    } catch (error) {
      return sendAssetError(reply, error);
    }
  });
}
