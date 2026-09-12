import { createHash } from 'node:crypto';
import { readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { MediaDirectoryInfo, MediaItem, MediaKind, MediaStatus } from '@littlefootprints/shared';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.tiff']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.3gp']);
// Indexed but cannot be thumbnailed by sharp prebuilds (no HEIF decoder).
const PLACEHOLDER_EXTENSIONS = new Set(['.heic', '.heif']);
const THUMBNAIL_LONG_EDGE = 512;

export class MediaError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export function getMediaRoot(): string {
  return process.env.MEDIA_LIBRARY_PATH ?? '/app/media';
}

export function getThumbnailDir(): string {
  return process.env.THUMBNAIL_DIR ?? 'data/thumbnails';
}

export async function getMediaStatus(): Promise<MediaStatus> {
  const root = getMediaRoot();
  if (!existsSync(root)) return { configured: false, directoryCount: 0 };
  const dirs = await listMediaDirectories();
  return { configured: true, directoryCount: dirs.length };
}

interface DirectoryScanEntry {
  info: MediaDirectoryInfo;
}

let directoryCache: { at: number; entries: DirectoryScanEntry[] } | null = null;
const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateMediaDirectoryCache(): void {
  directoryCache = null;
}

async function walkDirectories(
  root: string,
  currentRelative: string,
  out: DirectoryScanEntry[],
): Promise<void> {
  const entries = await readdir(path.join(root, currentRelative), { withFileTypes: true });
  let imageCount = 0;
  let videoCount = 0;
  let latest = 0;
  const subdirectories: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      subdirectories.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext) || PLACEHOLDER_EXTENSIONS.has(ext);
    const isVideo = VIDEO_EXTENSIONS.has(ext);
    if (!isImage && !isVideo) continue;
    try {
      const info = await stat(path.join(root, currentRelative, entry.name));
      latest = Math.max(latest, info.mtimeMs);
    } catch {
      continue;
    }
    if (isImage) imageCount += 1;
    else videoCount += 1;
  }
  if (imageCount + videoCount > 0) {
    const name = currentRelative.split('/').pop() ?? currentRelative;
    out.push({
      info: {
        path: currentRelative,
        name,
        imageCount,
        videoCount,
        latestModifiedAt: latest > 0 ? new Date(latest).toISOString() : '',
      },
    });
  }
  for (const sub of subdirectories) {
    await walkDirectories(root, currentRelative ? `${currentRelative}/${sub}` : sub, out);
  }
}

export async function listMediaDirectories(search?: string): Promise<MediaDirectoryInfo[]> {
  const root = getMediaRoot();
  if (!existsSync(root)) return [];
  if (!directoryCache || Date.now() - directoryCache.at > DIRECTORY_CACHE_TTL_MS) {
    const entries: DirectoryScanEntry[] = [];
    await walkDirectories(root, '', entries);
    directoryCache = { at: Date.now(), entries };
  }
  const keyword = search?.trim().toLowerCase();
  return directoryCache.entries
    .map((entry) => entry.info)
    .filter((info) => !keyword || info.path.toLowerCase().includes(keyword))
    .sort((a, b) => (a.latestModifiedAt < b.latestModifiedAt ? 1 : -1));
}

/** Resolves a relative path inside the media root, rejecting traversal and missing targets. */
export async function resolveMediaPath(relativePath: string, expect: 'file' | 'directory'): Promise<string> {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new MediaError('path required', 400);
  }
  const root = path.resolve(getMediaRoot());
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new MediaError('path escapes the media library', 400);
  }
  let info;
  try {
    info = await stat(resolved);
  } catch {
    throw new MediaError('path not found in media library', 404);
  }
  if (expect === 'directory' && !info.isDirectory()) {
    throw new MediaError('path is not a directory', 400);
  }
  if (expect === 'file' && !info.isFile()) {
    throw new MediaError('path is not a file', 400);
  }
  return resolved;
}

export async function listMediaItems(directoryPath: string): Promise<MediaItem[]> {
  const absoluteDir = await resolveMediaPath(directoryPath, 'directory');
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const items: MediaItem[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const placeholder = PLACEHOLDER_EXTENSIONS.has(ext);
    const kind: MediaKind | null = IMAGE_EXTENSIONS.has(ext) || placeholder
      ? 'image'
      : VIDEO_EXTENSIONS.has(ext)
        ? 'video'
        : null;
    if (!kind) continue;
    let sizeBytes = 0;
    let modifiedAt = '';
    try {
      const info = await stat(path.join(absoluteDir, entry.name));
      sizeBytes = info.size;
      modifiedAt = info.mtime.toISOString();
    } catch {
      continue;
    }
    const relativeFile = path.posix.join(directoryPath.split(path.sep).join('/'), entry.name);
    items.push({
      name: entry.name,
      kind,
      path: relativeFile,
      sizeBytes,
      modifiedAt,
      thumbnailUnavailable: placeholder || kind === 'video',
    });
  }
  return items.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

export async function generateThumbnail(filePath: string): Promise<{ body: Buffer; cached: boolean } | { placeholder: true } | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (PLACEHOLDER_EXTENSIONS.has(ext)) return { placeholder: true };
  if (VIDEO_EXTENSIONS.has(ext)) return { placeholder: true };
  if (!IMAGE_EXTENSIONS.has(ext)) return null;

  await mkdir(getThumbnailDir(), { recursive: true });
  const thumbPath = path.join(getThumbnailDir(), `${createHash('sha1').update(filePath).digest('hex')}.webp`);
  if (existsSync(thumbPath)) {
    const { readFile } = await import('node:fs/promises');
    return { body: await readFile(thumbPath), cached: true };
  }
  try {
    const buffer = await sharp(filePath, { failOn: 'none' })
      .rotate()
      .resize(THUMBNAIL_LONG_EDGE, THUMBNAIL_LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(thumbPath, buffer);
    return { body: buffer, cached: false };
  } catch {
    // Corrupt or undecodable image: serve the placeholder instead of failing.
    return { placeholder: true };
  }
}

export async function directoryExistsInLibrary(directoryPath: string): Promise<boolean> {
  try {
    await resolveMediaPath(directoryPath, 'directory');
    return true;
  } catch {
    return false;
  }
}
