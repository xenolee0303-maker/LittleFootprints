import { db } from '../db/index.js';
import { dailyJournalTable } from '../db/schema/daily-journal.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { DailyJournal, CreateDailyJournalInput, UpdateDailyJournalInput } from '@littlefootprints/shared';
import { childExists } from './child-profile.js';
import { markAiReportsStale } from './ai-reports.js';
import { listAssetsByJournals } from './media-assets.js';

function generateId(): string {
  return crypto.randomUUID();
}

type JournalRow = {
  id: string;
  childId: string;
  date: string;
  content: string;
  mood: string | null;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};

function deserialize(row: JournalRow): DailyJournal {
  return { ...row, mood: row.mood as DailyJournal['mood'], authorRole: row.authorRole as DailyJournal['authorRole'] };
}

async function attachAssets(rows: JournalRow[]): Promise<DailyJournal[]> {
  const assets = await listAssetsByJournals(rows.map((r) => r.id));
  return rows.map((row) => ({ ...deserialize(row), assets: assets.get(row.id) ?? [] }));
}

export async function listJournal(childId: string, range?: { from?: string; to?: string }): Promise<DailyJournal[]> {
  const clauses = [eq(dailyJournalTable.childId, childId)];
  if (range?.from) clauses.push(gte(dailyJournalTable.date, range.from));
  if (range?.to) clauses.push(lte(dailyJournalTable.date, range.to));
  const rows = (await db.select().from(dailyJournalTable).where(and(...clauses)).all()) as JournalRow[];
  return (await attachAssets(rows)).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export async function getJournalEntry(id: string): Promise<DailyJournal | null> {
  const row = (await db.select().from(dailyJournalTable).where(eq(dailyJournalTable.id, id)).get()) as JournalRow | undefined;
  if (!row) return null;
  return (await attachAssets([row]))[0];
}

export async function createJournalEntry(childId: string, input: CreateDailyJournalInput): Promise<DailyJournal | null> {
  if (!(await childExists(childId))) return null;
  const now = new Date().toISOString();
  const entry: DailyJournal = {
    id: generateId(),
    childId,
    date: input.date,
    content: input.content,
    mood: input.mood ?? null,
    authorRole: input.authorRole,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(dailyJournalTable).values(entry).run();
  await markAiReportsStale(childId, input.date, input.date);
  return { ...entry, assets: [] };
}

export async function updateJournalEntry(id: string, input: UpdateDailyJournalInput): Promise<DailyJournal | null> {
  const existing = await getJournalEntry(id);
  if (!existing) return null;
  const updated: DailyJournal = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await db.update(dailyJournalTable).set(updated).where(eq(dailyJournalTable.id, id)).run();
  const dates = [existing.date, updated.date].sort();
  await markAiReportsStale(existing.childId, dates[0], dates[1]);
  return getJournalEntry(id);
}

export async function deleteJournalEntry(id: string): Promise<boolean> {
  const existing = await getJournalEntry(id);
  if (!existing) return false;
  const result = await db.delete(dailyJournalTable).where(eq(dailyJournalTable.id, id)).run();
  if (result.changes > 0) await markAiReportsStale(existing.childId, existing.date, existing.date);
  return result.changes > 0;
}
