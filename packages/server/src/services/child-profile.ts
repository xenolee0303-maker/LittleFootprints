import { db } from '../db/index.js';
import { childProfileTable } from '../db/schema/child-profile.js';
import { childTable } from '../db/schema/child.js';
import { eq } from 'drizzle-orm';
import type { ChildProfile, UpsertChildProfileInput } from '@littlefootprints/shared';

export async function childExists(childId: string): Promise<boolean> {
  const row = await db.select({ id: childTable.id }).from(childTable).where(eq(childTable.id, childId)).get();
  return row !== undefined;
}

export async function getProfile(childId: string): Promise<ChildProfile | null> {
  const row = await db.select().from(childProfileTable).where(eq(childProfileTable.childId, childId)).get();
  if (!row) return null;
  return { ...row, gender: row.gender as ChildProfile['gender'], bloodType: row.bloodType as ChildProfile['bloodType'] };
}

export async function upsertProfile(childId: string, input: UpsertChildProfileInput): Promise<ChildProfile | null> {
  if (!(await childExists(childId))) return null;

  const existing = await getProfile(childId);
  const now = new Date().toISOString();
  // Partial upsert: unspecified fields keep their stored value; explicit null clears.
  const merged: ChildProfile = {
    childId,
    birthPlace: input.birthPlace !== undefined ? input.birthPlace : existing?.birthPlace ?? null,
    birthDate: input.birthDate !== undefined ? input.birthDate : existing?.birthDate ?? null,
    birthTime: input.birthTime !== undefined ? input.birthTime : existing?.birthTime ?? null,
    gender: (input.gender !== undefined ? input.gender : existing?.gender ?? 'unspecified') as ChildProfile['gender'],
    bloodType: input.bloodType !== undefined ? input.bloodType : existing?.bloodType ?? null,
    fatherHeightCm: input.fatherHeightCm !== undefined ? input.fatherHeightCm : existing?.fatherHeightCm ?? null,
    motherHeightCm: input.motherHeightCm !== undefined ? input.motherHeightCm : existing?.motherHeightCm ?? null,
    schoolStage: input.schoolStage !== undefined ? input.schoolStage : existing?.schoolStage ?? null,
    personality: input.personality !== undefined ? input.personality : existing?.personality ?? null,
    aiBackground: input.aiBackground !== undefined ? input.aiBackground : existing?.aiBackground ?? null,
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
