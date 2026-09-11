import { db } from '../db/index.js';
import { healthProfileTable, healthRecordTable } from '../db/schema/health.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { HealthProfile, HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, UpsertHealthProfileInput } from '@littlefootprints/shared';
import { childExists } from './child-profile.js';
import { markAiReportsStale } from './ai-reports.js';
import { listAssetsByHealthRecords } from './media-assets.js';

function generateId(): string {
  return crypto.randomUUID();
}

type RecordRow = {
  id: string;
  childId: string;
  date: string;
  type: string;
  title: string;
  facility: string | null;
  summary: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
};

function deserialize(row: RecordRow): HealthRecord {
  return { ...row, type: row.type as HealthRecord['type'] };
}

// ── Profile ──────────────────────────────────────────────

export async function getHealthProfile(childId: string): Promise<HealthProfile | null> {
  return db.select().from(healthProfileTable).where(eq(healthProfileTable.childId, childId)).get() ?? null;
}

export async function upsertHealthProfile(childId: string, input: UpsertHealthProfileInput): Promise<HealthProfile | null> {
  if (!(await childExists(childId))) return null;
  const existing = await getHealthProfile(childId);
  const now = new Date().toISOString();
  // Partial upsert: unspecified fields keep their stored value; explicit null clears.
  const merged: HealthProfile = {
    childId,
    allergies: input.allergies !== undefined ? input.allergies : existing?.allergies ?? null,
    chronicConditions: input.chronicConditions !== undefined ? input.chronicConditions : existing?.chronicConditions ?? null,
    notes: input.notes !== undefined ? input.notes : existing?.notes ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.insert(healthProfileTable).values(merged).onConflictDoUpdate({ target: healthProfileTable.childId, set: merged }).run();
  return merged;
}

// ── Records ──────────────────────────────────────────────

async function withAssets(rows: RecordRow[]): Promise<HealthRecord[]> {
  const assets = await listAssetsByHealthRecords(rows.map((r) => r.id));
  return rows.map((row) => ({ ...deserialize(row), assets: assets.get(row.id) ?? [] }));
}

export async function listHealthRecords(childId: string, range?: { from?: string; to?: string }): Promise<HealthRecord[]> {
  const clauses = [eq(healthRecordTable.childId, childId)];
  if (range?.from) clauses.push(gte(healthRecordTable.date, range.from));
  if (range?.to) clauses.push(lte(healthRecordTable.date, range.to));
  const rows = (await db.select().from(healthRecordTable).where(and(...clauses)).all()) as RecordRow[];
  return (await withAssets(rows)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getHealthRecord(id: string): Promise<HealthRecord | null> {
  const row = (await db.select().from(healthRecordTable).where(eq(healthRecordTable.id, id)).get()) as RecordRow | undefined;
  if (!row) return null;
  return (await withAssets([row]))[0];
}

export async function createHealthRecord(childId: string, input: CreateHealthRecordInput): Promise<HealthRecord | null> {
  if (!(await childExists(childId))) return null;
  const now = new Date().toISOString();
  const record: HealthRecord = {
    id: generateId(),
    childId,
    date: input.date,
    type: input.type,
    title: input.title,
    facility: input.facility ?? null,
    summary: input.summary ?? null,
    followUpDate: input.followUpDate ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(healthRecordTable).values(record).run();
  await markAiReportsStale(childId, input.date, input.followUpDate ?? input.date);
  return { ...record, assets: [] };
}

export async function updateHealthRecord(id: string, input: UpdateHealthRecordInput): Promise<HealthRecord | null> {
  const existing = await getHealthRecord(id);
  if (!existing) return null;
  const updated: HealthRecord = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await db.update(healthRecordTable).set(updated).where(eq(healthRecordTable.id, id)).run();
  const dates = [existing.date, updated.date, existing.followUpDate ?? '', updated.followUpDate ?? ''].sort();
  await markAiReportsStale(existing.childId, dates[0], dates[dates.length - 1]);
  return getHealthRecord(id);
}

export async function deleteHealthRecord(id: string): Promise<boolean> {
  const existing = await getHealthRecord(id);
  if (!existing) return false;
  const result = await db.delete(healthRecordTable).where(eq(healthRecordTable.id, id)).run();
  if (result.changes > 0) await markAiReportsStale(existing.childId, existing.date, existing.followUpDate ?? existing.date);
  return result.changes > 0;
}
