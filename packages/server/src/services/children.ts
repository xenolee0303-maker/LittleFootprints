import { db } from '../db/index.js';
import { childTable } from '../db/schema/child.js';
import { eq } from 'drizzle-orm';
import type { Child, CreateChildInput, UpdateChildInput } from '@littlefootprints/shared';

function generateId(): string {
  return crypto.randomUUID();
}

type ChildRow = {
  id: string;
  name: string;
  gender: string;
  createdAt: string;
  updatedAt: string;
};

function deserialize(row: ChildRow): Child {
  return { ...row, gender: row.gender as Child['gender'] };
}

export async function listChildren(): Promise<Child[]> {
  const rows = (await db.select().from(childTable).all()) as ChildRow[];
  return rows.map(deserialize);
}

export async function getChild(id: string): Promise<Child | null> {
  const row = (await db.select().from(childTable).where(eq(childTable.id, id)).get()) as ChildRow | undefined;
  return row ? deserialize(row) : null;
}

export async function createChild(input: CreateChildInput): Promise<Child> {
  const now = new Date().toISOString();
  const child: Child = {
    id: generateId(),
    name: input.name.trim(),
    gender: input.gender ?? 'unspecified',
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(childTable).values(child).run();
  return child;
}

export async function updateChild(id: string, input: UpdateChildInput): Promise<Child | null> {
  const existing = await getChild(id);
  if (!existing) return null;
  const updated: Child = {
    ...existing,
    ...input,
    name: (input.name ?? existing.name).trim(),
    gender: input.gender ?? existing.gender,
    updatedAt: new Date().toISOString(),
  };
  await db.update(childTable).set(updated).where(eq(childTable.id, id)).run();
  return updated;
}

export async function deleteChild(id: string): Promise<boolean> {
  const result = await db.delete(childTable).where(eq(childTable.id, id)).run();
  return result.changes > 0;
}
