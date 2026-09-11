import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { tmpdir } from 'node:os';

const uploadsRoot = path.join(tmpdir(), `lf-health-test-${process.pid}`);

function multipartBody(fieldName: string, fileName: string, contentType: string, content: Buffer): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----lfh${process.pid}`;
  return {
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

test('health profile, records, uploads and AI snapshot evidence', async (t) => {
  process.env.UPLOADS_DIR = uploadsRoot;
  process.env.THUMBNAIL_DIR = path.join(uploadsRoot, 'thumbs');
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp({ create: { width: 60, height: 60, channels: 3, background: 'purple' } }).jpeg().toBuffer();

  const child = await app.inject({ method: 'POST', url: '/api/children', payload: { name: '小明' } });
  const childId = JSON.parse(child.payload).id;
  let recordId: string;

  await t.test('profile upsert and round-trip', async () => {
    const empty = await app.inject({ method: 'GET', url: `/api/children/${childId}/health/profile` });
    assert.strictEqual(empty.statusCode, 200);
    assert.strictEqual(JSON.parse(empty.payload).allergies, null);

    const put = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/health/profile`,
      payload: { allergies: '尘螨、花生', chronicConditions: '哮喘', notes: '运动前需热身' },
    });
    assert.strictEqual(put.statusCode, 200);
    assert.strictEqual(JSON.parse(put.payload).chronicConditions, '哮喘');

    const over = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/health/profile`,
      payload: { allergies: null },
    });
    assert.strictEqual(JSON.parse(over.payload).allergies, null);
    assert.strictEqual(JSON.parse(over.payload).chronicConditions, '哮喘');
  });

  await t.test('record CRUD with validation', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/health/records`,
      payload: {
        date: '2026-09-10', type: 'illness', title: '哮喘复诊',
        facility: '市儿童医院', summary: '夜间咳嗽加重，医生调整了吸入剂剂量，两周后复查。',
        followUpDate: '2026-09-24',
      },
    });
    assert.strictEqual(post.statusCode, 201, post.payload);
    recordId = JSON.parse(post.payload).id;
    assert.strictEqual(JSON.parse(post.payload).followUpDate, '2026-09-24');

    const badType = await app.inject({
      method: 'POST', url: `/api/children/${childId}/health/records`,
      payload: { date: '2026-09-10', type: 'surgery', title: 'x' },
    });
    assert.strictEqual(badType.statusCode, 400);
    const badDate = await app.inject({
      method: 'POST', url: `/api/children/${childId}/health/records`,
      payload: { date: '2026-13-01', type: 'checkup', title: 'x' },
    });
    assert.strictEqual(badDate.statusCode, 400);

    const patched = await app.inject({
      method: 'PATCH', url: `/api/health-records/${recordId}`,
      payload: { summary: '症状缓解，继续原剂量。' },
    });
    assert.strictEqual(JSON.parse(patched.payload).summary, '症状缓解，继续原剂量。');

    const inRange = await app.inject({ method: 'GET', url: `/api/children/${childId}/health/records?from=2026-09-01&to=2026-09-30` });
    assert.strictEqual(JSON.parse(inRange.payload).length, 1);
  });

  await t.test('upload report image and PDF to record', async () => {
    const img = await app.inject({
      method: 'POST', url: `/api/health-records/${recordId}/assets`,
      ...multipartBody('file', '检查报告.jpg', 'image/jpeg', jpeg),
    });
    assert.strictEqual(img.statusCode, 201, img.payload);

    const pdf = await app.inject({
      method: 'POST', url: `/api/health-records/${recordId}/assets`,
      ...multipartBody('file', '血常规.pdf', 'application/pdf', Buffer.from('%PDF-1.4 fake')),
    });
    assert.strictEqual(pdf.statusCode, 201, pdf.payload);
    const pdfAsset = JSON.parse(pdf.payload);
    assert.strictEqual(pdfAsset.thumbnailUnavailable, true); // PDFs list without thumbnails

    const records = await app.inject({ method: 'GET', url: `/api/children/${childId}/health/records` });
    const record = JSON.parse(records.payload)[0];
    assert.equal(record.assets.length, 2);
  });

  await t.test('AI snapshot includes health context and evidence', async () => {
    const { buildAnalysisSnapshot } = await import('../services/ai-analysis-snapshot.js');
    const snapshot = await buildAnalysisSnapshot(childId, '2026-09-07');
    assert.ok(snapshot);
    assert.equal(snapshot.health?.chronicConditions, '哮喘');
    assert.equal(snapshot.metrics.healthRecordCount, 1);
    const evidence = snapshot.evidence.filter((e) => e.sourceType === 'health_record');
    assert.equal(evidence.length, 1);
    assert.ok(String(evidence[0]!.value).includes('吸入剂') || String(evidence[0]!.value).includes('缓解'));
  });

  await t.test('delete record cascades assets; missing child 404', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/api/health-records/${recordId}` });
    assert.strictEqual(del.statusCode, 200);
    const records = await app.inject({ method: 'GET', url: `/api/children/${childId}/health/records` });
    assert.strictEqual(JSON.parse(records.payload).length, 0);

    const missing = await app.inject({ method: 'GET', url: '/api/children/nope/health/records' });
    assert.strictEqual(missing.statusCode, 404);
  });

  await app.close();
});
