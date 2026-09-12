import { test } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/index.js';
import { childTable } from '../db/schema/child.js';
import { childProfileTable } from '../db/schema/child-profile.js';

test('vaccines: manual CRUD, template generation, administer marking', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const now = new Date().toISOString();
  const childId = crypto.randomUUID();
  await db.insert(childTable).values({ id: childId, name: '疫苗宝宝', createdAt: now, updatedAt: now }).run();

  await t.test('manual record CRUD and administer marking', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/vaccines`,
      payload: { name: '流感疫苗', dose: '第1剂', scheduledDate: '2026-10-01' },
    });
    assert.strictEqual(post.statusCode, 201, post.payload);
    const { id } = JSON.parse(post.payload);

    const administer = await app.inject({
      method: 'POST', url: `/api/vaccines/${id}/administer`,
      payload: { date: '2026-10-03' },
    });
    assert.strictEqual(administer.statusCode, 200);
    assert.strictEqual(JSON.parse(administer.payload).administeredDate, '2026-10-03');

    const patch = await app.inject({
      method: 'PATCH', url: `/api/vaccines/${id}`,
      payload: { note: '社区医院接种' },
    });
    assert.strictEqual(JSON.parse(patch.payload).note, '社区医院接种');

    const badDate = await app.inject({
      method: 'POST', url: `/api/children/${childId}/vaccines`,
      payload: { name: 'x', dose: '第1剂', scheduledDate: '2026-02-30' },
    });
    assert.strictEqual(badDate.statusCode, 400);
  });

  await t.test('template generation requires birth date', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/children/${childId}/vaccines/generate` });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(JSON.parse(res.payload).message.includes('出生日期'));
  });

  await t.test('template generates schedule from birth date; rerun skips existing', async () => {
    await db.insert(childProfileTable).values({ childId, birthDate: '2024-06-15', schoolStage: null, personality: null, aiBackground: null, createdAt: now, updatedAt: now }).run();

    const gen1 = await app.inject({ method: 'POST', url: `/api/children/${childId}/vaccines/generate` });
    assert.strictEqual(gen1.statusCode, 200);
    const created = JSON.parse(gen1.payload).created;
    assert.ok(created >= 20); // national program core entries

    const gen2 = await app.inject({ method: 'POST', url: `/api/children/${childId}/vaccines/generate` });
    assert.strictEqual(JSON.parse(gen2.payload).created, 0); // nothing duplicated

    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/vaccines` });
    const records = JSON.parse(list.payload);
    assert.strictEqual(records.length, created + 1); // + 前面手动添加的流感疫苗
    // 乙肝第1剂 scheduled at birth month: 2024-06-15
    const hepB1 = records.find((r: any) => r.name === '乙肝疫苗' && r.dose === '第1剂');
    assert.strictEqual(hepB1.scheduledDate, '2024-06-15');
    // 白破 at 72 months: 2024-06-15 + 6 years = 2030-06-15
    const dt = records.find((r: any) => r.name === '白破疫苗');
    assert.strictEqual(dt.scheduledDate, '2030-06-15');
    // sorted by scheduled date ascending, first is a birth-dose
    assert.strictEqual(records[0].scheduledDate, '2024-06-15');
  });

  await t.test('due list and missing child 404', async () => {
    const due = await app.inject({ method: 'GET', url: `/api/children/${childId}/vaccines` }); // listing works; due computed client-side in UI
    assert.strictEqual(due.statusCode, 200);

    const missing = await app.inject({ method: 'GET', url: '/api/children/nope/vaccines' });
    assert.strictEqual(missing.statusCode, 404);
  });

  await app.close();
});
