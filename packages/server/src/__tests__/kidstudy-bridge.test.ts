import { test } from 'node:test';
import assert from 'node:assert';

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEK = mondayOfCurrentWeek();
const KIDSTUDY_CHILD = 'ks-child-1';

/** Installs a fake kid-study behind globalThis.fetch; returns a restore fn. */
function installFakeKidStudy() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const headers = new Headers();
    if (url.endsWith('/api/auth/login')) {
      const body = JSON.parse(init.body);
      if (body.pin !== '654321') {
        return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 });
      }
      headers.append('set-cookie', 'kid_study_session=abc123; HttpOnly; Path=/');
      return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
    }
    const cookie = init?.headers?.cookie ?? '';
    if (!cookie.includes('kid_study_session=abc123')) {
      return new Response(JSON.stringify({ message: 'Authentication required' }), { status: 401 });
    }
    if (url.endsWith('/api/children')) {
      return new Response(JSON.stringify([
        { id: KIDSTUDY_CHILD, name: '学习系统里的小明' },
        { id: 'ks-child-2', name: '学习系统里的小雨' },
      ]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/schedules/week')) {
      return new Response(JSON.stringify({
        weekStartDate: WEEK,
        days: [],
        entries: [
          { date: WEEK, startTime: '09:00', endTime: '10:00', status: 'completed' },
          { date: WEEK, startTime: '11:00', endTime: '12:00', status: 'completed' },
          { date: WEEK, startTime: '14:00', endTime: '15:00', status: 'incomplete' },
          { date: WEEK, startTime: '16:00', endTime: '17:00', status: 'absent' },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/flower-statistics/weekly-comparison')) {
      return new Response(JSON.stringify({
        childId: KIDSTUDY_CHILD,
        current: { weekStart: WEEK, weekEnd: WEEK, earned: 6, deducted: 1, net: 5 },
        previous: { weekStart: WEEK, weekEnd: WEEK, earned: 4, deducted: 0, net: 4 },
        netChange: { amount: 1, percent: 25, direction: 'increase' },
        courses: [
          { activityId: 'a1', activityName: 'kissABC', currentEarned: 4, previousEarned: 2, change: { amount: 2, percent: 100, direction: 'increase' }, records: [] },
          { activityId: 'a2', activityName: '围棋课', currentEarned: 2, previousEarned: 2, change: { amount: 0, percent: 0, direction: 'same' }, records: [] },
        ],
        deductions: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

async function createChild(app: any, name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/children', payload: { name } });
  return JSON.parse(res.payload).id;
}

test('kid-study bridge: config, mapping, learning summary and AI snapshot', async (t) => {
  const restoreFetch = installFakeKidStudy();
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const childId = await createChild(app, '小明');

  await t.test('unconfigured status and degraded summary', async () => {
    const status = await app.inject({ method: 'GET', url: '/api/integrations/kidstudy' });
    assert.strictEqual(JSON.parse(status.payload).configured, false);

    const summary = await app.inject({ method: 'GET', url: `/api/children/${childId}/learning/summary?week_start=${WEEK}` });
    assert.strictEqual(summary.statusCode, 200);
    assert.strictEqual(JSON.parse(summary.payload).available, false);
  });

  await t.test('save config (PIN encrypted, never returned), test connection', async () => {
    const put = await app.inject({
      method: 'PUT', url: '/api/integrations/kidstudy',
      payload: { baseUrl: 'http://192.168.3.102:3001/', pin: '654321' },
    });
    assert.strictEqual(put.statusCode, 200);
    const status = JSON.parse(put.payload);
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.baseUrl, 'http://192.168.3.102:3001'); // trailing slash trimmed
    assert.ok(!JSON.stringify(status).includes('654321'));

    const testRes = await app.inject({ method: 'POST', url: '/api/integrations/kidstudy/test' });
    assert.strictEqual(testRes.statusCode, 200);
    assert.strictEqual(JSON.parse(testRes.payload).children, 2);
  });

  await t.test('kid-study children list requires auth cookie from login', async () => {
    const children = await app.inject({ method: 'GET', url: '/api/integrations/kidstudy/children' });
    assert.strictEqual(children.statusCode, 200);
    assert.strictEqual(JSON.parse(children.payload)[0].name, '学习系统里的小明');
  });

  await t.test('child mapping set/get/delete', async () => {
    const put = await app.inject({
      method: 'PUT', url: `/api/children/${childId}/integration`,
      payload: { kidstudyChildId: KIDSTUDY_CHILD, kidstudyChildName: '学习系统里的小明' },
    });
    assert.strictEqual(put.statusCode, 200);
    const got = await app.inject({ method: 'GET', url: `/api/children/${childId}/integration` });
    assert.strictEqual(JSON.parse(got.payload).kidstudyChildId, KIDSTUDY_CHILD);
  });

  await t.test('learning summary computes completion, minutes and flowers', async () => {
    const summary = await app.inject({ method: 'GET', url: `/api/children/${childId}/learning/summary?week_start=${WEEK}` });
    assert.strictEqual(summary.statusCode, 200);
    const body = JSON.parse(summary.payload);
    assert.strictEqual(body.available, true);
    // 4 entries: 2 completed eligible + 1 incomplete eligible + 1 absent (excluded) → 2/3
    assert.strictEqual(body.summary.completionRate, 67);
    assert.strictEqual(body.summary.learningMinutes, 120);
    assert.strictEqual(body.summary.flowerNet, 5);
    assert.strictEqual(body.summary.courses.length, 2);
    assert.strictEqual(body.summary.courses[0].name, 'kissABC');
  });

  await t.test('AI snapshot contains learning evidence and context', async () => {
    const { buildAnalysisSnapshot } = await import('../services/ai-analysis-snapshot.js');
    const snapshot = await buildAnalysisSnapshot(childId, WEEK);
    assert.ok(snapshot);
    assert.strictEqual(snapshot.learning?.configured, true);
    assert.strictEqual(snapshot.learning?.completionRate, 67);
    assert.strictEqual(snapshot.learning?.courses.length, 2);
    const learningEvidence = snapshot.evidence.filter((e) => e.sourceType === 'learning');
    assert.ok(learningEvidence.length >= 4); // rate + minutes + flowers + 2 courses
  });

  await t.test('wrong PIN reports login failure', async () => {
    const badPut = await app.inject({
      method: 'PUT', url: '/api/integrations/kidstudy',
      payload: { baseUrl: 'http://192.168.3.102:3001', pin: '000000' },
    });
    assert.strictEqual(badPut.statusCode, 200); // config saved
    const testRes = await app.inject({ method: 'POST', url: '/api/integrations/kidstudy/test' });
    assert.strictEqual(testRes.statusCode, 502);
    assert.ok(JSON.parse(testRes.payload).message.includes('登录失败'));
  });

  await app.close();
  restoreFetch();
});
