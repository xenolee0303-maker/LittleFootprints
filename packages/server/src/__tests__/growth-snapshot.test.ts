import { test } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/index.js';
import { childTable } from '../db/schema/child.js';
import { childProfileTable } from '../db/schema/child-profile.js';
import { interestTable } from '../db/schema/interest.js';
import { interestNoteTable } from '../db/schema/interest-note.js';
import { growthEventTable } from '../db/schema/growth-event.js';

test('growth snapshot builds evidence, metrics and four-week trends', async () => {
  const now = new Date().toISOString();
  const childId = crypto.randomUUID();
  const otherChild = crypto.randomUUID();
  await db.insert(childTable).values([
    { id: childId, name: '快照甲', createdAt: now, updatedAt: now },
    { id: otherChild, name: '快照乙', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(childProfileTable).values({ childId, birthDate: '2019-05-20', schoolStage: '小学二年级', personality: '好奇', aiBackground: '喜欢动手实验', createdAt: now, updatedAt: now }).run();
  const interestId = crypto.randomUUID();
  await db.insert(interestTable).values({ id: interestId, childId, name: '钢琴', category: 'art', status: 'active', startedAt: '2025-09-01', endedAt: null, description: null, createdAt: now, updatedAt: now }).run();
  await db.insert(interestNoteTable).values([
    { id: crypto.randomUUID(), interestId, date: '2026-08-05', type: 'practice', content: '练完小汤二', authorRole: 'parent', createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), interestId, date: '2026-07-20', type: 'practice', content: '上周的记录', authorRole: 'parent', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(growthEventTable).values({ id: crypto.randomUUID(), type: 'travel', title: '北京之旅', startDate: '2026-08-06', endDate: null, location: '北京', description: '全家出游', participantChildIds: JSON.stringify([childId, otherChild]), authorRole: 'parent', mediaDirectory: null, createdAt: now, updatedAt: now }).run();

  const { buildAnalysisSnapshot } = await import('../services/ai-analysis-snapshot.js');
  const snapshot = await buildAnalysisSnapshot(childId, '2026-08-03');
  assert.ok(snapshot);
  assert.equal(snapshot.childLabel, '快照甲');
  assert.equal(snapshot.growth?.background, '喜欢动手实验');
  assert.equal(snapshot.growth?.interests.length, 1);
  assert.equal(snapshot.growth?.interests[0]?.noteCountInRange, 1);
  assert.deepEqual(snapshot.growth?.interests[0]?.recentFourWeekNoteCounts, [1, 0, 1, 0]);
  assert.equal(snapshot.metrics.interestNoteCount, 1);
  assert.equal(snapshot.metrics.growthEventCount, 1);
  assert.equal(snapshot.metrics.activeInterestCount, 1);

  const noteEvidence = snapshot.evidence.filter((e) => e.sourceType === 'interest_note');
  assert.equal(noteEvidence.length, 1);
  assert.ok(String(noteEvidence[0]!.value).includes('练完小汤二'));
  const eventEvidence = snapshot.evidence.filter((e) => e.sourceType === 'growth_event');
  assert.equal(eventEvidence.length, 1);
  assert.ok(eventEvidence[0]!.label.includes('北京之旅'));

  assert.equal(await buildAnalysisSnapshot('missing-child', '2026-08-03'), null);
});

test('growth mutation marks overlapping ready reports stale', async () => {
  const now = new Date().toISOString();
  const childId = crypto.randomUUID();
  await db.insert(childTable).values({ id: childId, name: '过期测试', createdAt: now, updatedAt: now }).run();

  const { aiAnalysisReportTable } = await import('../db/schema/ai-analysis-report.js');
  const { eq } = await import('drizzle-orm');
  await db.insert(aiAnalysisReportTable).values({ id: crypto.randomUUID(), childId, weekStart: '2026-08-03', status: 'ready', currentRevisionId: null, createdAt: now, updatedAt: now }).run();

  const interestId = crypto.randomUUID();
  await db.insert(interestTable).values({ id: interestId, childId, name: '围棋', category: 'tech', status: 'active', startedAt: '2026-01-01', endedAt: null, description: null, createdAt: now, updatedAt: now }).run();

  const { createNote } = await import('../services/interests.js');
  const note = await createNote(interestId, { date: '2026-08-05', type: 'practice', content: '新纪录', authorRole: 'parent' });
  assert.ok(note);
  const report = await db.select().from(aiAnalysisReportTable).where(eq(aiAnalysisReportTable.childId, childId)).get();
  assert.equal(report?.status, 'stale');
});
