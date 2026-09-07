import { test } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mediaRoot = path.join(tmpdir(), `littlefootprints-media-test-${process.pid}`);
const thumbnailDir = path.join(mediaRoot, '-thumbs');

async function createChild(app: any): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/children', payload: { name: '小明' } });
  return JSON.parse(res.payload).id;
}

test('media library API', async (t) => {
  rmSync(mediaRoot, { recursive: true, force: true });
  const beijing = path.join(mediaRoot, '2026-08-北京旅游');
  const beach = path.join(mediaRoot, '2026-07-海边');
  const empty = path.join(mediaRoot, '空目录');
  const hidden = path.join(mediaRoot, '.trash');
  mkdirSync(beijing, { recursive: true });
  mkdirSync(beach, { recursive: true });
  mkdirSync(empty, { recursive: true });
  mkdirSync(hidden, { recursive: true });

  const sharp = (await import('sharp')).default;
  const jpeg = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#3366cc' } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#cc3366' } }).png().toBuffer();
  writeFileSync(path.join(beijing, 'IMG_0001.jpg'), jpeg);
  writeFileSync(path.join(beijing, 'IMG_0002.heic'), Buffer.from('fake-heic'));
  writeFileSync(path.join(beijing, 'VID_0001.mp4'), Buffer.alloc(1024, 7));
  writeFileSync(path.join(beijing, 'notes.txt'), Buffer.from('not media'));
  writeFileSync(path.join(beach, 'pic.png'), png);
  writeFileSync(path.join(hidden, 'hidden.jpg'), jpeg);

  process.env.MEDIA_LIBRARY_PATH = mediaRoot;
  process.env.THUMBNAIL_DIR = thumbnailDir;

  const { buildApp } = await import('../app.js');
  const { invalidateMediaDirectoryCache } = await import('../services/media-library.js');
  invalidateMediaDirectoryCache();
  const app = await buildApp();

  await t.test('status reports configured with directory count', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/media/status' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.configured, true);
    assert.strictEqual(body.directoryCount, 2); // empty and hidden dirs excluded
  });

  await t.test('directories list and search filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/media/directories' });
    assert.strictEqual(res.statusCode, 200);
    const dirs = JSON.parse(res.payload);
    assert.strictEqual(dirs.length, 2);
    const beijingDir = dirs.find((d: any) => d.name === '2026-08-北京旅游');
    assert.ok(beijingDir);
    assert.strictEqual(beijingDir.imageCount, 2);
    assert.strictEqual(beijingDir.videoCount, 1);

    const filtered = await app.inject({ method: 'GET', url: '/api/media/directories?search=北京' });
    assert.strictEqual(JSON.parse(filtered.payload).length, 1);
  });

  await t.test('items list marks kinds and unavailable thumbnails', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/media/items?path=2026-08-北京旅游' });
    assert.strictEqual(res.statusCode, 200);
    const items = JSON.parse(res.payload);
    assert.strictEqual(items.length, 3); // txt excluded
    const jpg = items.find((i: any) => i.name === 'IMG_0001.jpg');
    assert.strictEqual(jpg.kind, 'image');
    assert.strictEqual(jpg.thumbnailUnavailable, false);
    const heic = items.find((i: any) => i.name === 'IMG_0002.heic');
    assert.strictEqual(heic.thumbnailUnavailable, true);
    const mp4 = items.find((i: any) => i.name === 'VID_0001.mp4');
    assert.strictEqual(mp4.kind, 'video');
  });

  await t.test('thumb generates webp and heic/mp4 get 415', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/media/thumb?path=${encodeURIComponent('2026-08-北京旅游/IMG_0001.jpg')}`,
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'image/webp');
    assert.ok(res.body.length > 0);

    const heic = await app.inject({
      method: 'GET',
      url: `/api/media/thumb?path=${encodeURIComponent('2026-08-北京旅游/IMG_0002.heic')}`,
    });
    assert.strictEqual(heic.statusCode, 415);

    const mp4 = await app.inject({
      method: 'GET',
      url: `/api/media/thumb?path=${encodeURIComponent('2026-08-北京旅游/VID_0001.mp4')}`,
    });
    assert.strictEqual(mp4.statusCode, 415);
  });

  await t.test('original streams fully and supports Range', async () => {
    const filePath = '2026-08-北京旅游/VID_0001.mp4';
    const full = await app.inject({
      method: 'GET',
      url: `/api/media/original?path=${encodeURIComponent(filePath)}`,
    });
    assert.strictEqual(full.statusCode, 200);
    assert.strictEqual(full.headers['content-type'], 'video/mp4');
    assert.strictEqual(Number(full.headers['content-length']), 1024);

    const partial = await app.inject({
      method: 'GET',
      url: `/api/media/original?path=${encodeURIComponent(filePath)}`,
      headers: { range: 'bytes=0-99' },
    });
    assert.strictEqual(partial.statusCode, 206);
    assert.strictEqual(partial.headers['content-range'], 'bytes 0-99/1024');
    assert.strictEqual(Number(partial.headers['content-length']), 100);
  });

  await t.test('path traversal and missing paths are rejected', async () => {
    const escape = await app.inject({
      method: 'GET',
      url: `/api/media/items?path=${encodeURIComponent('../../etc')}`,
    });
    assert.strictEqual(escape.statusCode, 400);

    const absolute = await app.inject({
      method: 'GET',
      url: `/api/media/thumb?path=${encodeURIComponent('/etc/passwd')}`,
    });
    assert.strictEqual(absolute.statusCode, 400);

    const missing = await app.inject({
      method: 'GET',
      url: `/api/media/items?path=${encodeURIComponent('不存在')}`,
    });
    assert.strictEqual(missing.statusCode, 404);
  });

  await t.test('events bind, rebind and unbind media directories', async () => {
    const childId = await createChild(app);
    const created = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: {
        type: 'travel', title: '北京旅游', startDate: '2026-08-01',
        participantChildIds: [childId], mediaDirectory: '2026-08-北京旅游',
      },
    });
    assert.strictEqual(created.statusCode, 201);
    const event = JSON.parse(created.payload);
    assert.strictEqual(event.mediaDirectory, '2026-08-北京旅游');

    const badBind = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: {
        type: 'travel', title: 'x', startDate: '2026-08-01',
        participantChildIds: [childId], mediaDirectory: '没有这个目录',
      },
    });
    assert.strictEqual(badBind.statusCode, 400);

    const rebind = await app.inject({
      method: 'PATCH', url: `/api/growth-events/${event.id}`,
      payload: { mediaDirectory: '2026-07-海边' },
    });
    assert.strictEqual(JSON.parse(rebind.payload).mediaDirectory, '2026-07-海边');

    const unbind = await app.inject({
      method: 'PATCH', url: `/api/growth-events/${event.id}`,
      payload: { mediaDirectory: null },
    });
    assert.strictEqual(JSON.parse(unbind.payload).mediaDirectory, null);
  });

  await t.test('unconfigured library reports not configured without errors', async () => {
    process.env.MEDIA_LIBRARY_PATH = path.join(tmpdir(), `littlefootprints-media-missing-${process.pid}`);
    invalidateMediaDirectoryCache();
    const status = await app.inject({ method: 'GET', url: '/api/media/status' });
    assert.strictEqual(status.statusCode, 200);
    assert.strictEqual(JSON.parse(status.payload).configured, false);
    const dirs = await app.inject({ method: 'GET', url: '/api/media/directories' });
    assert.strictEqual(dirs.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(dirs.payload), []);
    process.env.MEDIA_LIBRARY_PATH = mediaRoot;
    invalidateMediaDirectoryCache();
  });

  await app.close();
  rmSync(mediaRoot, { recursive: true, force: true });
});
