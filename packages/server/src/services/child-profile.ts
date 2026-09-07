import { db } from '../db/index.js';
import { childProfileTable } from '../db/schema/child-profile.js';
import { childTable } from '../db/schema/child.js';
import { eq } from 'drizzle-orm';
import type { ChildProfile, UpsertChildProfileInput } from '@bloommate/shared';

export async function childExists(childId: string): Promise<boolean> {
  const row = await db.select({ id: childTable.id }).from(childTable).where(eq(childTable.id, childId)).get();
  return row !== undefined;
}

export async function getProfile(childId: string): Promise<ChildProfile | null> {
  const row = await db.select().from(childProfileTable).where(eq(childProfileTable.childId, childId)).get();
  return row ?? null;
}

export async function upsertProfile(childId: string, input: UpsertChildProfileInput): Promise<ChildProfile | null> {
  if (!(await childExists(childId))) return null;

  const existing = await getProfile(childId);
  const now = new Date().toISOString();
  const merged: ChildProfile = {
    childId,
    birthDate: input.birthDate ?? null,
    schoolStage: input.schoolStage ?? null,
    personality: input.personality ?? null,
    aiBackground: input.aiBackground ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db
    .insert(childProfileTable)
    .values(merged)
    .onConflictDoUpdate({ target: childProfileTable.childId, set: merged })
    .run();
  return merged;
}
