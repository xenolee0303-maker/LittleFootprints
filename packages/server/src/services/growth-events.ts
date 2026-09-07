import { db } from '../db/index.js';
import { growthEventTable } from '../db/schema/growth-event.js';
import { eq } from 'drizzle-orm';
import type { GrowthEvent, CreateGrowthEventInput, UpdateGrowthEventInput } from '@bloommate/shared';
import { childExists } from './child-profile.js';
import { markAiReportsStale } from './ai-reports.js';
import { listAssetsByEvents } from './media-assets.js';

function generateId(): string {
  return crypto.randomUUID();
}

type GrowthEventRow = {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  participantChildIds: string;
  authorRole: string;
  mediaDirectory: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listEvents(childId?: string): Promise<GrowthEvent[]> {
  const rows = await db.select().from(growthEventTable).all();
  const events = rows.map(deserializeEvent);
  const filtered = childId ? events.filter((e) => e.participantChildIds.includes(childId)) : events;
  const sorted = filtered.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const assetsByEvent = await listAssetsByEvents(sorted.map((e) => e.id));
  return sorted.map((e) => ({ ...e, assets: assetsByEvent.get(e.id) ?? [] }));
}

export async function getEvent(id: string): Promise<GrowthEvent | null> {
  const row = await db.select().from(growthEventTable).where(eq(growthEventTable.id, id)).get();
  if (!row) return null;
  const assets = (await listAssetsByEvents([id])).get(id) ?? [];
  return { ...deserializeEvent(row), assets };
}

export async function createEvent(input: CreateGrowthEventInput): Promise<GrowthEvent | null> {
  const childIds = input.participantChildIds;
  if (childIds.length === 0) return null;
  for (const childId of childIds) {
    if (!(await childExists(childId))) return null;
  }

  const now = new Date().toISOString();
  const event: GrowthEvent = {
    id: generateId(),
    type: input.type,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    participantChildIds: childIds,
    authorRole: input.authorRole ?? 'parent',
    mediaDirectory: input.mediaDirectory ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(growthEventTable).values(serializeEvent(event)).run();
  await markStaleForEvent(childIds, input.startDate, input.endDate ?? input.startDate);
  return event;
}

export async function updateEvent(id: string, input: UpdateGrowthEventInput): Promise<GrowthEvent | null> {
  const existing = await getEvent(id);
  if (!existing) return null;

  const participantChildIds = input.participantChildIds ?? existing.participantChildIds;
  if (participantChildIds.length === 0) return null;
  for (const childId of participantChildIds) {
    if (!(await childExists(childId))) return null;
  }

  const updated: GrowthEvent = {
    ...existing,
    ...input,
    participantChildIds,
    updatedAt: new Date().toISOString(),
  };
  await db.update(growthEventTable).set(serializeEvent(updated)).where(eq(growthEventTable.id, id)).run();
  const allChildren = Array.from(new Set([...existing.participantChildIds, ...participantChildIds]));
  const dates = [existing.startDate, existing.endDate ?? existing.startDate, updated.startDate, updated.endDate ?? updated.startDate];
  await markStaleForEvent(allChildren, dates[0], dates[3]);
  return updated;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const existing = await getEvent(id);
  const result = await db.delete(growthEventTable).where(eq(growthEventTable.id, id)).run();
  if (result.changes > 0 && existing) {
    await markStaleForEvent(existing.participantChildIds, existing.startDate, existing.endDate ?? existing.startDate);
  }
  return result.changes > 0;
}

async function markStaleForEvent(childIds: string[], from: string, to: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
  for (const childId of childIds) await markAiReportsStale(childId, from, to);
}

function serializeEvent(event: GrowthEvent): GrowthEventRow {
  return { ...event, participantChildIds: JSON.stringify(event.participantChildIds) };
}

function deserializeEvent(row: GrowthEventRow): GrowthEvent {
  return {
    ...row,
    type: row.type as GrowthEvent['type'],
    authorRole: row.authorRole as GrowthEvent['authorRole'],
    participantChildIds: JSON.parse(row.participantChildIds) as string[],
  };
}
