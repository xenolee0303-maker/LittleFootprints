import { db } from '../db/index.js';
import { vaccineRecordTable } from '../db/schema/vaccine-record.js';
import { childProfileTable } from '../db/schema/child-profile.js';
import { eq, and } from 'drizzle-orm';
import type { VaccineRecord, CreateVaccineRecordInput, UpdateVaccineRecordInput, VaccineTemplateItem } from '@littlefootprints/shared';
import { childExists } from './child-profile.js';

function generateId(): string {
  return crypto.randomUUID();
}

/** National immunization program (China) core vaccines, months after birth. */
export const VACCINE_TEMPLATE: VaccineTemplateItem[] = [
  { name: '乙肝疫苗', dose: '第1剂', monthsAfterBirth: 0 },
  { name: '卡介苗', dose: '第1剂', monthsAfterBirth: 0 },
  { name: '乙肝疫苗', dose: '第2剂', monthsAfterBirth: 1 },
  { name: '脊灰疫苗', dose: '第1剂', monthsAfterBirth: 2 },
  { name: '百白破疫苗', dose: '第1剂', monthsAfterBirth: 3 },
  { name: '脊灰疫苗', dose: '第2剂', monthsAfterBirth: 3 },
  { name: '百白破疫苗', dose: '第2剂', monthsAfterBirth: 4 },
  { name: '脊灰疫苗', dose: '第3剂', monthsAfterBirth: 4 },
  { name: '百白破疫苗', dose: '第3剂', monthsAfterBirth: 5 },
  { name: 'A群流脑多糖疫苗', dose: '第1剂', monthsAfterBirth: 6 },
  { name: '乙脑减毒活疫苗', dose: '第1剂', monthsAfterBirth: 8 },
  { name: '麻腮风疫苗', dose: '第1剂', monthsAfterBirth: 8 },
  { name: 'A群流脑多糖疫苗', dose: '第2剂', monthsAfterBirth: 9 },
  { name: '甲肝减毒活疫苗', dose: '第1剂', monthsAfterBirth: 18 },
  { name: '百白破疫苗', dose: '第4剂', monthsAfterBirth: 19 },
  { name: '麻腮风疫苗', dose: '第2剂', monthsAfterBirth: 18 },
  { name: '乙脑减毒活疫苗', dose: '第2剂', monthsAfterBirth: 24 },
  { name: '脊灰疫苗', dose: '第4剂', monthsAfterBirth: 48 },
  { name: 'A+C群流脑多糖疫苗', dose: '第1剂', monthsAfterBirth: 36 },
  { name: '白破疫苗', dose: '第1剂', monthsAfterBirth: 72 },
  { name: 'A+C群流脑多糖疫苗', dose: '第2剂', monthsAfterBirth: 72 },
];

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export async function listVaccineRecords(childId: string): Promise<VaccineRecord[]> {
  const rows = await db.select().from(vaccineRecordTable).where(eq(vaccineRecordTable.childId, childId)).all();
  return rows.sort((a, b) => {
    const aDate = a.scheduledDate ?? '9999-12-31';
    const bDate = b.scheduledDate ?? '9999-12-31';
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    return a.name < b.name ? -1 : 1;
  });
}

export async function getVaccineRecord(id: string): Promise<VaccineRecord | null> {
  return db.select().from(vaccineRecordTable).where(eq(vaccineRecordTable.id, id)).get() ?? null;
}

export async function createVaccineRecord(childId: string, input: CreateVaccineRecordInput): Promise<VaccineRecord | null> {
  if (!(await childExists(childId))) return null;
  const now = new Date().toISOString();
  const record: VaccineRecord = {
    id: generateId(),
    childId,
    name: input.name,
    dose: input.dose,
    scheduledDate: input.scheduledDate ?? null,
    administeredDate: input.administeredDate ?? null,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(vaccineRecordTable).values(record).run();
  return record;
}

export async function updateVaccineRecord(id: string, input: UpdateVaccineRecordInput): Promise<VaccineRecord | null> {
  const existing = await getVaccineRecord(id);
  if (!existing) return null;
  const updated: VaccineRecord = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await db.update(vaccineRecordTable).set(updated).where(eq(vaccineRecordTable.id, id)).run();
  return updated;
}

export async function deleteVaccineRecord(id: string): Promise<boolean> {
  const result = await db.delete(vaccineRecordTable).where(eq(vaccineRecordTable.id, id)).run();
  return result.changes > 0;
}

/** Marks one record as administered today (or a given date). */
export async function markVaccineAdministered(id: string, date: string): Promise<VaccineRecord | null> {
  return updateVaccineRecord(id, { administeredDate: date });
}

/**
 * Generates records from the national immunization program template, skipping
 * entries whose (name, dose) already exist for this child. Requires a birth
 * date to compute scheduled dates.
 */
export async function generateFromTemplate(childId: string): Promise<{ created: number; skipped: boolean } | null> {
  if (!(await childExists(childId))) return null;
  const profile = await db.select().from(childProfileTable).where(eq(childProfileTable.childId, childId)).get();
  if (!profile?.birthDate) return { created: 0, skipped: true };

  const existing = await db.select().from(vaccineRecordTable).where(eq(vaccineRecordTable.childId, childId)).all();
  const existingKeys = new Set(existing.map((row) => `${row.name}|${row.dose}`));
  const now = new Date().toISOString();
  const toInsert = VACCINE_TEMPLATE
    .filter((item) => !existingKeys.has(`${item.name}|${item.dose}`))
    .map((item) => ({
      id: generateId(),
      childId,
      name: item.name,
      dose: item.dose,
      scheduledDate: addMonths(profile.birthDate!, item.monthsAfterBirth),
      administeredDate: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    }));
  for (const row of toInsert) {
    await db.insert(vaccineRecordTable).values(row).run();
  }
  return { created: toInsert.length, skipped: false };
}

/** Vaccines due (scheduled on/before today) but not yet administered. */
export async function listDueVaccines(childId: string): Promise<VaccineRecord[]> {
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const rows = await db
    .select()
    .from(vaccineRecordTable)
    .where(and(eq(vaccineRecordTable.childId, childId)))
    .all();
  return rows
    .filter((row) => row.administeredDate === null && row.scheduledDate !== null && row.scheduledDate <= key)
    .sort((a, b) => ((a.scheduledDate ?? '') < (b.scheduledDate ?? '') ? -1 : 1));
}
