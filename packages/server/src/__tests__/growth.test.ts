import { test } from 'node:test';
import assert from 'node:assert';

async function createChild(app: any, name = '小明'): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/children', payload: { name } });
  assert.strictEqual(res.statusCode, 201);
  return JSON.parse(res.payload).id;
}

test('child profile API', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childId = await createChild(app);

  await t.test('GET profile returns empty fields before first save', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/children/${childId}/profile` });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.childId, childId);
    assert.strictEqual(body.birthDate, null);
    assert.strictEqual(body.aiBackground, null);
  });

  await t.test('PUT profile creates then overwrites', async () => {
    const put1 = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/profile`,
      payload: { birthDate: '2019-05-20', schoolStage: '小学二年级', personality: '好奇', aiBackground: '背景A' },
    });
    assert.strictEqual(put1.statusCode, 200);
    assert.strictEqual(JSON.parse(put1.payload).birthDate, '2019-05-20');

    const put2 = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/profile`,
      payload: { birthDate: null, schoolStage: '小学三年级' },
    });
    assert.strictEqual(put2.statusCode, 200);
    const body2 = JSON.parse(put2.payload);
    assert.strictEqual(body2.birthDate, null);
    assert.strictEqual(body2.schoolStage, '小学三年级');
    assert.strictEqual(body2.aiBackground, null);

    const get = await app.inject({ method: 'GET', url: `/api/children/${childId}/profile` });
    assert.strictEqual(JSON.parse(get.payload).schoolStage, '小学三年级');
  });

  await t.test('PUT profile rejects bad birthDate', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/profile`,
      payload: { birthDate: '2019-13-40' },
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('PUT profile 404 for unknown child', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/children/nope/profile',
      payload: { schoolStage: 'x' },
    });
    assert.strictEqual(res.statusCode, 404);
  });

  await app.close();
});

test('growth measurements API', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childId = await createChild(app);

  await t.test('POST + GET + PATCH + DELETE', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/measurements`,
      payload: { date: '2026-01-10', heightCm: 122.5, weightKg: 24, note: '体检' },
    });
    assert.strictEqual(post.statusCode, 201);
    const { id } = JSON.parse(post.payload);

    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/measurements` });
    assert.strictEqual(list.statusCode, 200);
    assert.strictEqual(JSON.parse(list.payload).length, 1);

    const patch = await app.inject({
      method: 'PATCH', url: `/api/measurements/${id}`,
      payload: { heightCm: 123.1 },
    });
    assert.strictEqual(patch.statusCode, 200);
    assert.strictEqual(JSON.parse(patch.payload).heightCm, 123.1);
    assert.strictEqual(JSON.parse(patch.payload).weightKg, 24);

    const del = await app.inject({ method: 'DELETE', url: `/api/measurements/${id}` });
    assert.strictEqual(del.statusCode, 200);
    const after = await app.inject({ method: 'GET', url: `/api/children/${childId}/measurements` });
    assert.strictEqual(JSON.parse(after.payload).length, 0);
  });

  await t.test('POST rejects measurement without any value', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/children/${childId}/measurements`,
      payload: { date: '2026-01-10' },
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('PATCH cannot clear both values', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/measurements`,
      payload: { date: '2026-02-01', heightCm: 122, weightKg: 24 },
    });
    const { id } = JSON.parse(post.payload);
    const res = await app.inject({
      method: 'PATCH', url: `/api/measurements/${id}`,
      payload: { heightCm: null, weightKg: null },
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('POST 404 for unknown child', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/children/nope/measurements',
      payload: { date: '2026-01-10', heightCm: 122 },
    });
    assert.strictEqual(res.statusCode, 404);
  });

  await app.close();
});

test('interests API', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childId = await createChild(app);

  await t.test('POST interest with defaults, then list with notes', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/interests`,
      payload: { name: '钢琴', category: 'art', startedAt: '2025-09-01' },
    });
    assert.strictEqual(post.statusCode, 201);
    const interest = JSON.parse(post.payload);
    assert.strictEqual(interest.status, 'exploring');

    const noteRes = await app.inject({
      method: 'POST', url: `/api/interests/${interest.id}/notes`,
      payload: { date: '2026-01-15', type: 'practice', content: '练完小汤二', authorRole: 'parent' },
    });
    assert.strictEqual(noteRes.statusCode, 201);

    const childNote = await app.inject({
      method: 'POST', url: `/api/interests/${interest.id}/notes`,
      payload: { date: '2026-01-16', type: 'reflection', content: '今天弹得好开心', authorRole: 'child' },
    });
    assert.strictEqual(childNote.statusCode, 201);

    const list = await app.inject({ method: 'GET', url: `/api/children/${childId}/interests` });
    const interests = JSON.parse(list.payload);
    assert.strictEqual(interests.length, 1);
    assert.strictEqual(interests[0].notes.length, 2);
    assert.strictEqual(interests[0].notes[0].date, '2026-01-16'); // newest first
  });

  await t.test('PATCH interest status transition', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/interests`,
      payload: { name: '围棋', category: 'tech', startedAt: '2026-01-01', status: 'active' },
    });
    const { id } = JSON.parse(post.payload);
    const patch = await app.inject({
      method: 'PATCH', url: `/api/interests/${id}`,
      payload: { status: 'ended', endedAt: '2026-03-01' },
    });
    assert.strictEqual(patch.statusCode, 200);
    assert.strictEqual(JSON.parse(patch.payload).status, 'ended');
  });

  await t.test('DELETE interest cascades notes', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/interests`,
      payload: { name: '游泳', category: 'sport', startedAt: '2026-01-01' },
    });
    const { id } = JSON.parse(post.payload);
    await app.inject({
      method: 'POST', url: `/api/interests/${id}/notes`,
      payload: { date: '2026-01-15', type: 'practice', content: 'x', authorRole: 'parent' },
    });
    const del = await app.inject({ method: 'DELETE', url: `/api/interests/${id}` });
    assert.strictEqual(del.statusCode, 200);
    const notes = await app.inject({ method: 'GET', url: `/api/interests/${id}/notes` });
    assert.strictEqual(notes.statusCode, 404);
  });

  await t.test('note rejects bad authorRole and 404 unknown interest', async () => {
    const post = await app.inject({
      method: 'POST', url: `/api/children/${childId}/interests`,
      payload: { name: '画画', category: 'art', startedAt: '2026-01-01' },
    });
    const { id } = JSON.parse(post.payload);

    const bad = await app.inject({
      method: 'POST', url: `/api/interests/${id}/notes`,
      payload: { date: '2026-01-15', type: 'practice', content: 'x', authorRole: 'robot' },
    });
    assert.strictEqual(bad.statusCode, 400);

    const missing = await app.inject({
      method: 'POST', url: '/api/interests/nope/notes',
      payload: { date: '2026-01-15', type: 'practice', content: 'x', authorRole: 'parent' },
    });
    assert.strictEqual(missing.statusCode, 404);
  });

  await app.close();
});

test('growth events API', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childA = await createChild(app, '小明');
  const childB = await createChild(app, '小雨');

  await t.test('POST shared event, filter by participant', async () => {
    const post = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: {
        type: 'travel', title: '北京旅游', startDate: '2026-08-01', endDate: '2026-08-05',
        location: '北京', participantChildIds: [childA, childB],
      },
    });
    assert.strictEqual(post.statusCode, 201);

    const solo = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: { type: 'competition', title: '钢琴比赛', startDate: '2026-07-20', participantChildIds: [childA] },
    });
    assert.strictEqual(solo.statusCode, 201);

    const all = await app.inject({ method: 'GET', url: '/api/growth-events' });
    assert.strictEqual(JSON.parse(all.payload).length, 2);
    assert.strictEqual(JSON.parse(all.payload)[0].title, '北京旅游'); // newest startDate first

    const onlyB = await app.inject({ method: 'GET', url: `/api/growth-events?childId=${childB}` });
    const eventsB = JSON.parse(onlyB.payload);
    assert.strictEqual(eventsB.length, 1);
    assert.strictEqual(eventsB[0].title, '北京旅游');
  });

  await t.test('PATCH partial update does not clobber fields', async () => {
    const post = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: { type: 'gathering', title: '生日聚会', startDate: '2026-06-01', participantChildIds: [childA] },
    });
    const { id, type } = JSON.parse(post.payload);
    const patch = await app.inject({
      method: 'PATCH', url: `/api/growth-events/${id}`,
      payload: { title: '六岁生日聚会' },
    });
    assert.strictEqual(patch.statusCode, 200);
    const body = JSON.parse(patch.payload);
    assert.strictEqual(body.title, '六岁生日聚会');
    assert.strictEqual(body.type, type);
    assert.strictEqual(body.participantChildIds.length, 1);
  });

  await t.test('rejects endDate before startDate and unknown participants', async () => {
    const badRange = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: { type: 'travel', title: 'x', startDate: '2026-08-05', endDate: '2026-08-01', participantChildIds: [childA] },
    });
    assert.strictEqual(badRange.statusCode, 400);

    const badChild = await app.inject({
      method: 'POST', url: '/api/growth-events',
      payload: { type: 'travel', title: 'x', startDate: '2026-08-05', participantChildIds: ['nope'] },
    });
    assert.strictEqual(badChild.statusCode, 400);
  });

  await app.close();
});
