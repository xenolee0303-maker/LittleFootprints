import { db } from '../db/index.js';
import { growthMeasurementTable } from '../db/schema/growth-measurement.js';
import { eq } from 'drizzle-orm';
import type { GrowthMeasurement, CreateGrowthMeasurementInput, UpdateGrowthMeasurementInput } from '@littlefootprints/shared';
import { childExists } from './child-profile.js';

function generateId(): string {
  return crypto.randomUUID();
}

export async function listMeasurements(childId: string): Promise<GrowthMeasurement[]> {
  const rows = await db
    .select()
    .from(growthMeasurementTable)
    .where(eq(growthMeasurementTable.childId, childId))
    .all();
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function createMeasurement(
  childId: string,
  input: CreateGrowthMeasurementInput,
): Promise<GrowthMeasurement | null> {
  if (!(await childExists(childId))) return null;

  const now = new Date().toISOString();
  const measurement: GrowthMeasurement = {
    id: generateId(),
    childId,
    date: input.date,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    headCm: input.headCm ?? null,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(growthMeasurementTable).values(measurement).run();
  return measurement;
}

export async function updateMeasurement(
  id: string,
  input: UpdateGrowthMeasurementInput,
): Promise<GrowthMeasurement | null> {
  const existing = await getMeasurement(id);
  if (!existing) return null;

  const updated: GrowthMeasurement = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await db.update(growthMeasurementTable).set(updated).where(eq(growthMeasurementTable.id, id)).run();
  return updated;
}

export async function deleteMeasurement(id: string): Promise<boolean> {
  const result = await db.delete(growthMeasurementTable).where(eq(growthMeasurementTable.id, id)).run();
  return result.changes > 0;
}

export async function getMeasurement(id: string): Promise<GrowthMeasurement | null> {
  const row = await db.select().from(growthMeasurementTable).where(eq(growthMeasurementTable.id, id)).get();
  return row ?? null;
}
