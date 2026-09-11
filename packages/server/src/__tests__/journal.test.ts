import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { tmpdir } from 'node:os';

const uploadsRoot = path.join(tmpdir(), `lf-journal-test-${process.pid}`);

function multipartBody(fieldName: string, fileName: string, contentType: string, content: Buffer): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----lf${process.pid}`;
  return {
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

test('daily journal CRUD, upload, aggregation and cascade', async (t) => {
  process.env.UPLOADS_DIR = uploadsRoot;
  process.env.THUMBNAIL_DIR = path.join(uploadsRoot, 'thumbs');
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp({ create: { width: 80, height: 80, channels: 3, background: 'green' } }).jpeg().toBuffer();

  const child = await app.inject({ method: 'POST', url: '/api/children', payload: { name: '小明' } });
  const childId = JSON.parse(child.payload).id;
  let entryId: string;

  await t.test('create with mood, list newest first', async () => {
    const e1 = await app.inject({
      method: 'POST', url: `/api/children/${childId}/journal`,
      payload: { date: '2026-09-01', content: '今天第一天上学', mood: 'good', authorRole: 'parent' },
    });
    assert.strictEqual(e1.statusCode, 201);
    const e2 = await app.inject({
      method: 'POST', url: `/api/children/${childId}/journal`,
      payload: { date: '2026-09-07', content: '我学会跳绳了！', mood: 'great', authorRole: 'child' },
    });
    assert.strictEqual(e2.statusCode, 201);
    entryId = JSON.parse(e2.payload).id;

    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/journal` });
    const entries = JSON.parse(list.payload);
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].date, '2026-09-07');
    assert.strictEqual(entries[0].mood, 'great');
    assert.strictEqual(entries[0].authorRole, 'child');
  });

  await t.test('range filter', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/journal?from=2026-09-05&to=2026-09-07` });
    assert.strictEqual(JSON.parse(list.payload).length, 1);
  });

  await t.test('validation: bad mood, bad date, missing content', async () => {
    const badMood = await app.inject({
      method: 'POST', url: `/api/children/${childId}/journal`,
      payload: { date: '2026-09-07', content: 'x', mood: 'angry', authorRole: 'parent' },
    });
    assert.strictEqual(badMood.statusCode, 400);
    const badDate = await app.inject({
      method: 'POST', url: `/api/children/${childId}/journal`,
      payload: { date: '2026-02-30', content: 'x', authorRole: 'parent' },
    });
    assert.strictEqual(badDate.statusCode, 400);
    const noContent = await app.inject({
      method: 'POST', url: `/api/children/${childId}/journal`,
      payload: { date: '2026-09-07', authorRole: 'parent' },
    });
    assert.strictEqual(noContent.statusCode, 400);
  });

  await t.test('patch content and clear mood', async () => {
    const patched = await app.inject({
      method: 'PATCH', url: `/api/journal/${entryId}`,
      payload: { content: '我学会跳绳了，还教会了同学！', mood: null },
    });
    assert.strictEqual(patched.statusCode, 200);
    const body = JSON.parse(patched.payload);
    assert.strictEqual(body.mood, null);
    assert.ok(body.content.includes('教会了同学'));
  });

  await t.test('upload asset to journal entry, aggregated in list', async () => {
    const uploaded = await app.inject({
      method: 'POST', url: `/api/journal/${entryId}/assets`,
      ...multipartBody('file', '跳绳.jpg', 'image/jpeg', jpeg),
    });
    assert.strictEqual(uploaded.statusCode, 201, uploaded.payload);
    const assetId = JSON.parse(uploaded.payload).id;

    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/journal` });
    const entry = JSON.parse(list.payload).find((e: any) => e.id === entryId);
    assert.equal(entry.assets.length, 1);
    assert.equal(entry.assets[0].fileName, '跳绳.jpg');

    const thumb = await app.inject({ method: 'GET', url: `/api/assets/${assetId}/thumb` });
    assert.strictEqual(thumb.statusCode, 200);
  });

  await t.test('delete cascades assets; 404s', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/api/journal/${entryId}` });
    assert.strictEqual(del.statusCode, 200);
    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/journal` });
    assert.strictEqual(JSON.parse(list.payload).length, 1);

    const missingChild = await app.inject({ method: 'GET', url: '/api/children/nope/journal' });
    assert.strictEqual(missingChild.statusCode, 404);
    const missingUpload = await app.inject({
      method: 'POST', url: '/api/journal/nope/assets',
      ...multipartBody('file', 'x.jpg', 'image/jpeg', jpeg),
    });
    assert.strictEqual(missingUpload.statusCode, 404);
  });

  await app.close();
});
