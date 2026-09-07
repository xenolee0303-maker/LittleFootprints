import { test } from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { childTable } from '../db/schema/child.js';
import { aiAnalysisReportTable } from '../db/schema/ai-analysis-report.js';
import { aiAnalysisReportRevisionTable } from '../db/schema/ai-analysis-report.js';

test('child summaries endpoint exposes only childSummary of ready reports', async (t) => {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const now = new Date().toISOString();
  const childId = crypto.randomUUID();
  await db.insert(childTable).values({ id: childId, name: '亮点小朋友', createdAt: now, updatedAt: now }).run();

  const makeReport = (weekStart: string, status: string, title: string) => {
    const reportId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const summary = { title, text: `${title}的正文`, goal: '本周小目标' };
    // Circular FKs (report↔revision): insert report without pointer, then revision, then link.
    db.insert(aiAnalysisReportTable).values({
      id: reportId, childId, weekStart, status, currentRevisionId: null,
      createdAt: now, updatedAt: now,
    }).run();
    db.insert(aiAnalysisReportRevisionTable).values({
      id: revisionId, reportId, revision: 1,
      payloadJson: JSON.stringify({ summary: '家长可见', observations: [], recommendations: [], childSummary: summary }),
      childReportJson: JSON.stringify(summary),
      createdAt: now,
    }).run();
    db.update(aiAnalysisReportTable).set({ currentRevisionId: revisionId }).where(eq(aiAnalysisReportTable.id, reportId)).run();
    return reportId;
  };

  makeReport('2026-08-03', 'ready', '第一周亮点');
  makeReport('2026-08-10', 'ready', '第二周亮点');
  makeReport('2026-08-17', 'stale', '过期的一周'); // stale must be excluded
  makeReport('2026-08-24', 'failed', '失败的一周'); // failed must be excluded

  await t.test('returns ready summaries newest first with only childSummary fields', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/children/${childId}/child-summaries` });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.summaries.length, 2);
    assert.strictEqual(body.summaries[0].weekStart, '2026-08-10');
    assert.strictEqual(body.summaries[0].childSummary.title, '第二周亮点');
    assert.strictEqual(body.summaries[0].childSummary.goal, '本周小目标');
    const serialized = JSON.stringify(body.summaries[0]);
    assert.ok(!serialized.includes('observations'));
    assert.ok(!serialized.includes('家长可见'));
  });

  await t.test('limit parameter is respected', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/children/${childId}/child-summaries?limit=1` });
    assert.strictEqual(JSON.parse(res.payload).summaries.length, 1);
  });

  await t.test('empty and 404 cases', async () => {
    const emptyChild = crypto.randomUUID();
    await db.insert(childTable).values({ id: emptyChild, name: '没有报告', createdAt: now, updatedAt: now }).run();
    const empty = await app.inject({ method: 'GET', url: `/api/children/${emptyChild}/child-summaries` });
    assert.strictEqual(empty.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(empty.payload), { summaries: [] });

    const missing = await app.inject({ method: 'GET', url: '/api/children/nope/child-summaries' });
    assert.strictEqual(missing.statusCode, 404);
  });

  await app.close();
});
