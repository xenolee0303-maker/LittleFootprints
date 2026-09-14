import { eq } from 'drizzle-orm';
import type { AnalysisEvidence, AnalysisSnapshot, AiConfidence } from '@littlefootprints/shared';
import { db } from '../db/index.js';
import { childTable } from '../db/schema/child.js';
import { childProfileTable } from '../db/schema/child-profile.js';
import { interestTable } from '../db/schema/interest.js';
import { interestNoteTable } from '../db/schema/interest-note.js';
import { growthEventTable } from '../db/schema/growth-event.js';
import { dailyJournalTable } from '../db/schema/daily-journal.js';
import { healthProfileTable, healthRecordTable } from '../db/schema/health.js';
import { fetchLearningSummary } from './kidstudy-bridge.js';
import { computeBazi } from './bazi.js';
import { getComparisonWeeks, addDays } from './week-utils.js';
import { getWeekStartDate } from '@littlefootprints/shared';

function evidence(sourceType: AnalysisEvidence['sourceType'], sourceId: string, label: string, value: string | number): AnalysisEvidence {
  return { id: `evidence:${sourceType}:${sourceId}`, sourceType, sourceId, label, value };
}

function confidence(records: number): AiConfidence {
  if (records < 2) return 'low';
  if (records >= 8) return 'high';
  return 'medium';
}

export async function buildAnalysisSnapshot(
  childId: string,
  weekStart: string,
  range?: { dateFrom?: string; dateTo?: string },
): Promise<AnalysisSnapshot | null> {
  if (range?.dateFrom || range?.dateTo) {
    const from = range.dateFrom ?? weekStart;
    const to = range.dateTo ?? addDays(from, 6);
    const isSingleDay = from === to;
    if (!isSingleDay && (getWeekStartDate(from) !== from || to !== addDays(from, 6))) {
      throw new Error('date range must be a complete local week or a single day');
    }
  }
  const weeks = getComparisonWeeks(weekStart);
  const child = await db.select({ id: childTable.id, name: childTable.name }).from(childTable).where(eq(childTable.id, childId)).get();
  if (!child) return null;

  const rangeFrom = range?.dateFrom ?? weeks.current.weekStart;
  const rangeTo = range?.dateTo ?? weeks.current.weekEnd;
  const learning = await fetchLearningSummary(childId, rangeFrom);
  const [profile, interests, allNotes, allEvents, allJournal, healthProfile, allHealthRecords] = await Promise.all([
    db.select().from(childProfileTable).where(eq(childProfileTable.childId, childId)).get(),
    db.select().from(interestTable).where(eq(interestTable.childId, childId)).all(),
    db.select().from(interestNoteTable).all(),
    db.select().from(growthEventTable).all(),
    db.select().from(dailyJournalTable).where(eq(dailyJournalTable.childId, childId)).all(),
    db.select().from(healthProfileTable).where(eq(healthProfileTable.childId, childId)).get(),
    db.select().from(healthRecordTable).where(eq(healthRecordTable.childId, childId)).all(),
  ]);
  const bazi = computeBazi({ birthDate: profile?.birthDate ?? null, birthTime: profile?.birthTime ?? null });

  const interestById = new Map(interests.map((i) => [i.id, i]));
  const notesInRange = allNotes.filter((n) => interestById.has(n.interestId) && n.date >= rangeFrom && n.date <= rangeTo);
  const journalInRange = allJournal.filter((entry) => entry.date >= rangeFrom && entry.date <= rangeTo);
  const healthInRange = allHealthRecords.filter((r) => (r.date >= rangeFrom && r.date <= rangeTo) || (r.followUpDate !== null && r.followUpDate >= rangeFrom && r.followUpDate <= rangeTo));
  const eventsInRange = allEvents
    .filter((e) => (JSON.parse(e.participantChildIds) as string[]).includes(childId))
    .filter((e) => e.startDate >= rangeFrom && e.startDate <= rangeTo);

  const activeInterestCount = interests.filter((i) => i.status === 'active' || i.status === 'exploring').length;
  const noteCountByInterest = new Map<string, number>();
  for (const note of notesInRange) {
    noteCountByInterest.set(note.interestId, (noteCountByInterest.get(note.interestId) ?? 0) + 1);
  }
  const childNotes = allNotes.filter((n) => interestById.has(n.interestId));
  const trendCounts = new Map<string, number[]>();
  for (const interest of interests) {
    trendCounts.set(interest.id, [0, 1, 2, 3].map((i) => {
      const from = addDays(rangeFrom, -i * 7);
      const to = addDays(rangeFrom, -i * 7 + 6) > rangeTo ? rangeTo : addDays(rangeFrom, -i * 7 + 6);
      return childNotes.filter((n) => n.interestId === interest.id && n.date >= from && n.date <= to).length;
    }));
  }

  const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…` : value);
  const evidenceRows: AnalysisEvidence[] = [];
  for (const note of notesInRange) {
    const interest = interestById.get(note.interestId)!;
    evidenceRows.push(evidence('interest_note', note.id, `${interest.name} 进展`, truncate(`${note.date} ${note.type}${note.authorRole === 'child' ? '(孩子记录)' : ''}: ${note.content}`, 120)));
  }
  for (const event of eventsInRange) {
    evidenceRows.push(evidence('growth_event', event.id, `成长事件:${event.title}`, truncate(`${event.type} ${event.startDate}${event.endDate ? `~${event.endDate}` : ''}${event.location ? ` ${event.location}` : ''} ${event.description ?? ''}`, 120)));
  }
  for (const entry of journalInRange) {
    evidenceRows.push(evidence('journal', entry.id, `日志 ${entry.date}`, truncate(`${entry.date}${entry.mood ? ` ${entry.mood}` : ''}${entry.authorRole === 'child' ? '(孩子记录)' : ''}: ${entry.content}`, 120)));
  }
  for (const record of healthInRange) {
    evidenceRows.push(evidence('health_record', record.id, `就诊:${record.title}`, truncate(`${record.date} ${record.type}${record.facility ? ` ${record.facility}` : ''} ${record.summary ?? ''}`, 120)));
  }
  if (bazi.available) {
    for (const fe of bazi.fiveElements) {
      evidenceRows.push(evidence('aggregate', `${childId}:bazi:${fe.element}`, `五行·${fe.element}`, fe.count));
    }
  }
  if (learning.available && learning.summary) {
    const summary = learning.summary;
    evidenceRows.push(evidence('learning', `${childId}:${rangeFrom}:rate`, '学习完成率', summary.completionRate));
    evidenceRows.push(evidence('learning', `${childId}:${rangeFrom}:minutes`, '学习分钟数', summary.learningMinutes));
    evidenceRows.push(evidence('learning', `${childId}:${rangeFrom}:flowers`, '小红花净得', summary.flowerNet));
    for (const course of summary.courses) {
      evidenceRows.push(evidence('learning', `${childId}:${rangeFrom}:course:${course.name}`, `课程:${course.name}`, course.flowerEarned));
    }
  }

  const recordCount = notesInRange.length + eventsInRange.length + journalInRange.length + healthInRange.length + (learning.available && learning.summary ? learning.summary.completedCount : 0);
  const completeness = Math.min(1, recordCount / 6);

  return {
    childId,
    childLabel: child.name,
    range: {
      currentStart: rangeFrom,
      currentEnd: rangeTo,
      previousStart: weeks.previous.weekStart,
      previousEnd: weeks.previous.weekEnd,
    },
    metrics: {
      activeInterestCount,
      interestNoteCount: notesInRange.length,
      growthEventCount: eventsInRange.length,
      journalEntryCount: journalInRange.length,
      healthRecordCount: healthInRange.length,
      ...(learning.available && learning.summary ? { learningCompletionRate: learning.summary.completionRate, learningMinutes: learning.summary.learningMinutes, learningFlowerEarned: learning.summary.flowerEarned, learningFlowerNet: learning.summary.flowerNet } : {}),
      totalInterestCount: interests.length,
    },
    bazi: bazi.available ? {
      lunarDate: bazi.lunarDate,
      zodiac: bazi.zodiac,
      xingZuo: bazi.xingZuo,
      timeKnown: bazi.timeKnown,
      pillars: bazi.pillars.map((p) => `${p.pillar}柱 ${p.ganZhi}（${p.wuXing}·${p.naYin}）`),
      fiveElements: bazi.fiveElements,
      dayMaster: bazi.dayMaster,
      note: '传统命理历法计算，仅供文化趣味视角',
    } : undefined,
    health: {
      allergies: healthProfile?.allergies ?? null,
      chronicConditions: healthProfile?.chronicConditions ?? null,
      notes: healthProfile?.notes ?? null,
    },
    learning: learning.available && learning.summary ? {
      configured: true,
      completionRate: learning.summary.completionRate,
      learningMinutes: learning.summary.learningMinutes,
      flowerEarned: learning.summary.flowerEarned,
      flowerNet: learning.summary.flowerNet,
      courses: learning.summary.courses,
    } : { configured: false, completionRate: null, learningMinutes: null, flowerEarned: null, flowerNet: null, courses: [] },
    growth: {
      background: profile?.aiBackground ?? null,
      schoolStage: profile?.schoolStage ?? null,
      birthDate: profile?.birthDate ?? null,
      interests: interests.map((i) => ({
        id: i.id, name: i.name, category: i.category, status: i.status,
        startedAt: i.startedAt, endedAt: i.endedAt, description: i.description,
        noteCountInRange: noteCountByInterest.get(i.id) ?? 0,
        recentFourWeekNoteCounts: trendCounts.get(i.id) ?? [0, 0, 0, 0],
      })),
    },
    evidence: evidenceRows,
    dataCompleteness: completeness,
    confidence: confidence(recordCount),
    generatedAt: new Date().toISOString(),
  };
}
