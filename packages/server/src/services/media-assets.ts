import { mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MediaAssetInfo, MediaKind } from '@littlefootprints/shared';
import { db } from '../db/index.js';
import { mediaAssetTable } from '../db/schema/media-asset.js';
import { generateThumbnail } from './media-library.js';

export const MAX_ASSETS_PER_NOTE = 9;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.tiff', '.heic', '.heif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.3gp']);
const PLACEHOLDER_EXTENSIONS = new Set(['.heic', '.heif']);

export function getUploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? 'data/uploads';
}

export class AssetError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export function assetKindFor(fileName: string): MediaKind | null {
  const ext = path.extname(fileName).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

type MediaAssetRow = { id: string; noteId: string | null; eventId: string | null; kind: string; fileName: string; storagePath: string; sizeBytes: number; createdAt: string };

function toInfo(row: { id: string; kind: string; fileName: string; sizeBytes: number; storagePath: string }): MediaAssetInfo {
  const ext = path.extname(row.fileName).toLowerCase();
  return {
    id: row.id,
    kind: row.kind as MediaKind,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    thumbnailUnavailable: PLACEHOLDER_EXTENSIONS.has(ext) || row.kind === 'video',
  };
}

export type AssetOwner = { noteId: string } | { eventId: string };

export async function attachAsset(owner: AssetOwner, fileName: string, data: Buffer): Promise<MediaAssetInfo> {
  const kind = assetKindFor(fileName);
  if (!kind) throw new AssetError(`不支持的文件类型：${path.extname(fileName) || '(无扩展名)'}。支持常见图片和 mp4/mov 等视频`, 400);

  const ownerColumn = 'noteId' in owner ? mediaAssetTable.noteId : mediaAssetTable.eventId;
  const ownerId = 'noteId' in owner ? owner.noteId : owner.eventId;
  const existing = await db.select({ id: mediaAssetTable.id }).from(mediaAssetTable).where(eq(ownerColumn, ownerId)).all();
  if (existing.length >= MAX_ASSETS_PER_NOTE) {
    throw new AssetError(`最多 ${MAX_ASSETS_PER_NOTE} 个附件`, 400);
  }

  const id = crypto.randomUUID();
  const safeName = fileName.replace(/[\\/\r\n]/g, '_').slice(0, 120) || `file${path.extname(fileName)}`;
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = path.posix.join(month, `${id}${path.extname(safeName).toLowerCase()}`);
  const absolute = path.join(getUploadsRoot(), storagePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);

  const now = new Date().toISOString();
  const row = { id, noteId: 'noteId' in owner ? owner.noteId : null, eventId: 'eventId' in owner ? owner.eventId : null, kind, fileName: safeName, storagePath, sizeBytes: data.byteLength, createdAt: now };
  await db.insert(mediaAssetTable).values(row).run();
  return toInfo(row);
}

export async function listAssetsByNotes(noteIds: string[]): Promise<Map<string, MediaAssetInfo[]>> {
  return collectAssets(mediaAssetTable.noteId, noteIds);
}

export async function listAssetsByEvents(eventIds: string[]): Promise<Map<string, MediaAssetInfo[]>> {
  return collectAssets(mediaAssetTable.eventId, eventIds);
}

async function collectAssets(column: typeof mediaAssetTable.noteId | typeof mediaAssetTable.eventId, ids: string[]): Promise<Map<string, MediaAssetInfo[]>> {
  const result = new Map<string, MediaAssetInfo[]>();
  if (ids.length === 0) return result;
  const rows: MediaAssetRow[] = await db.select().from(mediaAssetTable).where(inArray(column, ids)).all();
  for (const row of rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    const ownerId = row.noteId ?? row.eventId;
    if (!ownerId) continue;
    const list = result.get(ownerId) ?? [];
    list.push(toInfo(row));
    result.set(ownerId, list);
  }
  return result;
}

export async function getAsset(id: string) {
  const row: MediaAssetRow | undefined = await db.select().from(mediaAssetTable).where(eq(mediaAssetTable.id, id)).get();
  if (!row) return null;
  return { row, info: toInfo(row), absolutePath: path.join(getUploadsRoot(), row.storagePath) };
}

export async function deleteAsset(id: string): Promise<boolean> {
  const existing = await getAsset(id);
  if (!existing) return false;
  await db.delete(mediaAssetTable).where(eq(mediaAssetTable.id, id)).run();
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(existing.absolutePath);
  } catch {
    // The DB row is gone; a stray file is harmless.
  }
  return true;
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.3gp': 'video/3gpp',
};

function contentTypeFor(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** Streams a stored file with HTTP Range support (video seeking) and cache headers. */
export async function sendAssetFile(request: FastifyRequest, reply: FastifyReply, absolutePath: string, fileName: string): Promise<void> {
  let info;
  try {
    info = await stat(absolutePath);
  } catch {
    throw new AssetError('文件不存在', 404);
  }
  reply.header('Content-Type', contentTypeFor(fileName));
  reply.header('Accept-Ranges', 'bytes');
  // Uploaded files are immutable once stored: let the browser cache for a day.
  reply.header('Cache-Control', 'public, max-age=86400');

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
      await reply.send();
      return;
    }
    const resolvedStart = start ?? Math.max(0, info.size - (end ?? 0));
    const resolvedEnd = Math.min(end ?? info.size - 1, info.size - 1);
    reply.status(206);
    reply.header('Content-Range', `bytes ${resolvedStart}-${resolvedEnd}/${info.size}`);
    reply.header('Content-Length', resolvedEnd - resolvedStart + 1);
    await reply.send(createReadStream(absolutePath, { start: resolvedStart, end: resolvedEnd }));
    return;
  }

  reply.header('Content-Length', info.size);
  await reply.send(createReadStream(absolutePath));
}

export async function sendAssetThumb(reply: FastifyReply, absolutePath: string, fileName: string): Promise<void> {
  const result = await generateThumbnail(absolutePath);
  if (!result || 'placeholder' in result) {
    reply.status(415).send({ message: 'no thumbnail available for this file' });
    return;
  }
  reply.header('Content-Type', 'image/webp');
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  await reply.send(result.body);
}

export function uploadsConfigured(): boolean {
  return true;
}
