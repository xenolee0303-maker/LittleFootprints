import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

const uploadsRoot = path.join(tmpdir(), `littlefootprints-uploads-test-${process.pid}`);

function multipartBody(fieldName: string, fileName: string, contentType: string, content: Buffer): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----littlefootprints${process.pid}`;
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function createChild(app: any): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/children', payload: { name: '小明' } });
  return JSON.parse(res.payload).id;
}

async function createNoteWithInterest(app: any): Promise<string> {
  const childId = await createChild(app);
  const interest = await app.inject({
    method: 'POST', url: `/api/children/${childId}/interests`,
    payload: { name: '画画', category: 'art', startedAt: '2026-01-05', status: 'active' },
  });
  const note = await app.inject({
    method: 'POST', url: `/api/interests/${JSON.parse(interest.payload).id}/notes`,
    payload: { date: '2026-09-07', type: 'work', content: '画了一幅海底世界', authorRole: 'child' },
  });
  return JSON.parse(note.payload).id;
}

test('interest note assets upload, serve, thumbnail and delete', async (t) => {
  process.env.UPLOADS_DIR = uploadsRoot;
  process.env.THUMBNAIL_DIR = path.join(uploadsRoot, '-thumbs');
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#e67e22' } }).jpeg().toBuffer();

  let noteId: string;
  let imageAssetId: string;
  let videoAssetId: string;

  await t.test('uploads image and video, and note lists them', async () => {
    noteId = await createNoteWithInterest(app);

    const image = await app.inject({
      method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
      ...multipartBody('file', '海底世界.jpg', 'image/jpeg', jpeg),
    });
    assert.strictEqual(image.statusCode, 201, image.payload);
    const imageAsset = JSON.parse(image.payload);
    assert.strictEqual(imageAsset.kind, 'image');
    assert.strictEqual(imageAsset.thumbnailUnavailable, false);
    imageAssetId = imageAsset.id;

    const video = await app.inject({
      method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
      ...multipartBody('file', '讲解.mp4', 'video/mp4', Buffer.alloc(2048, 3)),
    });
    assert.strictEqual(video.statusCode, 201, video.payload);
    videoAssetId = JSON.parse(video.payload).id;

    const child = await app.inject({ method: 'GET', url: '/api/children' });
    const childId = JSON.parse(child.payload)[0].id;
    const interests = await app.inject({ method: 'GET', url: `/api/children/${childId}/interests` });
    const note = JSON.parse(interests.payload)[0].notes.find((n: any) => n.id === noteId);
    assert.equal(note.assets.length, 2);
    assert.equal(note.assets.find((a: any) => a.kind === 'video').thumbnailUnavailable, true);
  });

  await t.test('thumbnail serves webp for image, 415 for video', async () => {
    const thumb = await app.inject({ method: 'GET', url: `/api/assets/${imageAssetId}/thumb` });
    assert.strictEqual(thumb.statusCode, 200);
    assert.strictEqual(thumb.headers['content-type'], 'image/webp');
    assert.ok(thumb.body.length > 0);

    const videoThumb = await app.inject({ method: 'GET', url: `/api/assets/${videoAssetId}/thumb` });
    assert.strictEqual(videoThumb.statusCode, 415);
  });

  await t.test('original streams with Range', async () => {
    const full = await app.inject({ method: 'GET', url: `/api/assets/${videoAssetId}` });
    assert.strictEqual(full.statusCode, 200);
    assert.strictEqual(full.headers['content-type'], 'video/mp4');
    assert.strictEqual(Number(full.headers['content-length']), 2048);

    const partial = await app.inject({ method: 'GET', url: `/api/assets/${videoAssetId}`, headers: { range: 'bytes=0-511' } });
    assert.strictEqual(partial.statusCode, 206);
    assert.strictEqual(partial.headers['content-range'], 'bytes 0-511/2048');
  });

  await t.test('rejects unsupported types and enforces per-note limit', async () => {
    const bad = await app.inject({
      method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
      ...multipartBody('file', 'notes.txt', 'text/plain', Buffer.from('hello')),
    });
    assert.strictEqual(bad.statusCode, 400);

    for (let i = 0; i < 7; i++) {
      await app.inject({
        method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
        ...multipartBody('file', `more-${i}.png`, 'image/png', jpeg),
      });
    }
    const overLimit = await app.inject({
      method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
      ...multipartBody('file', 'one-too-many.png', 'image/png', jpeg),
    });
    assert.strictEqual(overLimit.statusCode, 400);
    assert.ok(overLimit.payload.includes('最多'));
  });

  await t.test('delete removes asset and file', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/api/assets/${imageAssetId}` });
    assert.strictEqual(del.statusCode, 200);
    const missing = await app.inject({ method: 'GET', url: `/api/assets/${imageAssetId}` });
    assert.strictEqual(missing.statusCode, 404);
  });

  await t.test('upload to missing note 404', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/interest-notes/nope/assets',
      ...multipartBody('file', 'x.jpg', 'image/jpeg', jpeg),
    });
    assert.strictEqual(res.statusCode, 404);
  });

  await app.close();
  assert.ok(existsSync(uploadsRoot));
  readdirSync(uploadsRoot);
});

test('assets are removed with the owning note', async (t) => {
  process.env.UPLOADS_DIR = uploadsRoot;
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).jpeg().toBuffer();

  const childId = await createChild(app);
  const interest = await app.inject({
    method: 'POST', url: `/api/children/${childId}/interests`,
    payload: { name: '手工', category: 'life', startedAt: '2026-01-05' },
  });
  const interestId = JSON.parse(interest.payload).id;
  const note = await app.inject({
    method: 'POST', url: `/api/interests/${interestId}/notes`,
    payload: { date: '2026-09-07', type: 'work', content: '折纸', authorRole: 'parent' },
  });
  const noteId = JSON.parse(note.payload).id;
  const uploaded = await app.inject({
    method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
    ...multipartBody('file', '折纸.jpg', 'image/jpeg', jpeg),
  });
  const assetId = JSON.parse(uploaded.payload).id;

  await app.inject({ method: 'DELETE', url: `/api/interest-notes/${noteId}` });
  const gone = await app.inject({ method: 'GET', url: `/api/assets/${assetId}` });
  assert.strictEqual(gone.statusCode, 404);

  await app.close();
});

test('growth event assets upload, aggregate and cascade', async (t) => {
  process.env.UPLOADS_DIR = uploadsRoot;
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 50, height: 50, channels: 3, background: 'blue' } }).png().toBuffer();

  const childId = await createChild(app);
  const created = await app.inject({
    method: 'POST', url: '/api/growth-events',
    payload: { type: 'competition', title: '英语演讲比赛', startDate: '2026-09-01', participantChildIds: [childId] },
  });
  const eventId = JSON.parse(created.payload).id;

  await t.test('upload to event and see it in list and detail', async () => {
    const uploaded = await app.inject({
      method: 'POST', url: `/api/growth-events/${eventId}/assets`,
      ...multipartBody('file', '演讲视频.mp4', 'video/mp4', Buffer.alloc(1024, 9)),
    });
    assert.strictEqual(uploaded.statusCode, 201, uploaded.payload);
    const assetId = JSON.parse(uploaded.payload).id;

    const list = await app.inject({ method: 'GET', url: '/api/growth-events' });
    const event = JSON.parse(list.payload).find((e: any) => e.id === eventId);
    assert.equal(event.assets.length, 1);
    assert.equal(event.assets[0].kind, 'video');

    const streamed = await app.inject({ method: 'GET', url: `/api/assets/${assetId}`, headers: { range: 'bytes=0-255' } });
    assert.strictEqual(streamed.statusCode, 206);
  });

  await t.test('upload to missing event 404; deleting event cascades assets', async () => {
    const missing = await app.inject({
      method: 'POST', url: '/api/growth-events/nope/assets',
      ...multipartBody('file', 'x.png', 'image/png', png),
    });
    assert.strictEqual(missing.statusCode, 404);

    const list = await app.inject({ method: 'GET', url: '/api/growth-events' });
    const event = JSON.parse(list.payload).find((e: any) => e.id === eventId);
    const assetId = event.assets[0].id;
    await app.inject({ method: 'DELETE', url: `/api/growth-events/${eventId}` });
    const gone = await app.inject({ method: 'GET', url: `/api/assets/${assetId}` });
    assert.strictEqual(gone.statusCode, 404);
  });

  await app.close();
});

test('uploads over MAX_ASSET_SIZE_MB return a clear 413', async (t) => {
  process.env.MAX_ASSET_SIZE_MB = '1';
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childId = await createChild(app);
  const interest = await app.inject({
    method: 'POST', url: `/api/children/${childId}/interests`,
    payload: { name: '钢琴', category: 'art', startedAt: '2026-01-05' },
  });
  const interestId = JSON.parse(interest.payload).id;
  const note = await app.inject({
    method: 'POST', url: `/api/interests/${interestId}/notes`,
    payload: { date: '2026-09-12', type: 'practice', content: '大文件', authorRole: 'parent' },
  });
  const noteId = JSON.parse(note.payload).id;

  const big = Buffer.alloc(1536 * 1024, 1); // 1.5MB > 1MB limit
  const res = await app.inject({
    method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
    ...multipartBody('file', 'big.jpg', 'image/jpeg', big),
  });
  assert.strictEqual(res.statusCode, 413);
  assert.ok(JSON.parse(res.payload).message.includes('超过大小限制'));

  const ok = await app.inject({
    method: 'POST', url: `/api/interest-notes/${noteId}/assets`,
    ...multipartBody('file', 'small.jpg', 'image/jpeg', Buffer.alloc(512 * 1024, 2)),
  });
  assert.strictEqual(ok.statusCode, 201);

  delete process.env.MAX_ASSET_SIZE_MB;
  await app.close();
});
