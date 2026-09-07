import { db } from '../db/index.js';
import { interestTable } from '../db/schema/interest.js';
import { interestNoteTable } from '../db/schema/interest-note.js';
import { eq, inArray } from 'drizzle-orm';
import type {
  Interest,
  InterestWithNotes,
  InterestNote,
  CreateInterestInput,
  UpdateInterestInput,
  CreateInterestNoteInput,
  UpdateInterestNoteInput,
} from '@littlefootprints/shared';
import { childExists } from './child-profile.js';
import { markAiReportsStale } from './ai-reports.js';
import { listAssetsByNotes } from './media-assets.js';

function generateId(): string {
  return crypto.randomUUID();
}

type InterestRow = {
  id: string;
  childId: string;
  name: string;
  category: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type InterestNoteRow = {
  id: string;
  interestId: string;
  date: string;
  type: string;
  content: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};

function deserializeInterest(row: InterestRow): Interest {
  return {
    ...row,
    category: row.category as Interest['category'],
    status: row.status as Interest['status'],
  };
}

function deserializeNote(row: InterestNoteRow): InterestNote {
  return {
    ...row,
    type: row.type as InterestNote['type'],
    authorRole: row.authorRole as InterestNote['authorRole'],
  };
}

export async function listInterests(childId: string): Promise<InterestWithNotes[]> {
  const interests = (await db.select().from(interestTable).where(eq(interestTable.childId, childId)).all()).map(deserializeInterest);
  if (interests.length === 0) return [];

  const rawNotes = (await db
    .select()
    .from(interestNoteTable)
    .where(inArray(interestNoteTable.interestId, interests.map((i) => i.id)))
    .all()).map(deserializeNote);
  const assetsByNote = await listAssetsByNotes(rawNotes.map((n) => n.id));
  const notes: InterestNote[] = rawNotes.map((note) => ({ ...note, assets: assetsByNote.get(note.id) ?? [] }));
  const notesByInterest = new Map<string, InterestNote[]>();
  for (const note of notes) {
    const list = notesByInterest.get(note.interestId) ?? [];
    list.push(note);
    notesByInterest.set(note.interestId, list);
  }

  return interests.map((interest) => ({
    ...interest,
    notes: (notesByInterest.get(interest.id) ?? []).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    ),
  }));
}

export async function getInterest(id: string): Promise<Interest | null> {
  const row = await db.select().from(interestTable).where(eq(interestTable.id, id)).get();
  return row ? deserializeInterest(row) : null;
}

export async function createInterest(childId: string, input: CreateInterestInput): Promise<Interest | null> {
  if (!(await childExists(childId))) return null;

  const now = new Date().toISOString();
  const interest: Interest = {
    id: generateId(),
    childId,
    name: input.name,
    category: input.category,
    status: input.status ?? 'exploring',
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(interestTable).values(interest).run();
  return interest;
}

export async function updateInterest(id: string, input: UpdateInterestInput): Promise<Interest | null> {
  const existing = await getInterest(id);
  if (!existing) return null;

  const updated: Interest = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await db.update(interestTable).set(updated).where(eq(interestTable.id, id)).run();
  return updated;
}

export async function deleteInterest(id: string): Promise<boolean> {
  const result = await db.delete(interestTable).where(eq(interestTable.id, id)).run();
  return result.changes > 0;
}

export async function listNotes(interestId: string): Promise<InterestNote[] | null> {
  if (!(await getInterest(interestId))) return null;
  const rows = (await db.select().from(interestNoteTable).where(eq(interestNoteTable.interestId, interestId)).all()).map(deserializeNote);
  const assetsByNote = await listAssetsByNotes(rows.map((n) => n.id));
  return rows
    .map((note): InterestNote => ({ ...note, assets: assetsByNote.get(note.id) ?? [] }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function getNote(id: string): Promise<InterestNote | null> {
  const row = await db.select().from(interestNoteTable).where(eq(interestNoteTable.id, id)).get();
  return row ? deserializeNote(row) : null;
}

export async function createNote(interestId: string, input: CreateInterestNoteInput): Promise<InterestNote | null> {
  if (!(await getInterest(interestId))) return null;

  const now = new Date().toISOString();
  const note: InterestNote = {
    id: generateId(),
    interestId,
    date: input.date,
    type: input.type,
    content: input.content,
    authorRole: input.authorRole,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(interestNoteTable).values(note).run();
  await markStaleForNote(interestId, input.date);
  return { ...note, assets: [] };
}

export async function updateNote(id: string, input: UpdateInterestNoteInput): Promise<InterestNote | null> {
  const existing = await getNote(id);
  if (!existing) return null;

  const updated: InterestNote = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await db.update(interestNoteTable).set(updated).where(eq(interestNoteTable.id, id)).run();
  await markStaleForNote(existing.interestId, existing.date, updated.date);
  const assets = (await listAssetsByNotes([id])).get(id) ?? [];
  return { ...updated, assets };
}

export async function deleteNote(id: string): Promise<boolean> {
  const existing = await getNote(id);
  const result = await db.delete(interestNoteTable).where(eq(interestNoteTable.id, id)).run();
  if (result.changes > 0 && existing) await markStaleForNote(existing.interestId, existing.date);
  return result.changes > 0;
}

async function markStaleForNote(interestId: string, ...dates: string[]): Promise<void> {
  const interest = await getInterest(interestId);
  if (!interest) return;
  const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (valid.length === 0) return;
  await markAiReportsStale(interest.childId, valid[0], valid[valid.length - 1]);
}
