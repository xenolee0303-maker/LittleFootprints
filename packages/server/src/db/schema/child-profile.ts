import { sqliteTable, text, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const childProfileTable = sqliteTable('child_profile', {
  childId: text('child_id').primaryKey().references(() => childTable.id, { onDelete: 'cascade' }),
  birthPlace: text('birth_place'),
  birthDate: text('birth_date'),
  birthTime: text('birth_time'),
  gender: text('gender').notNull().default('unspecified'),
  bloodType: text('blood_type'),
  fatherHeightCm: real('father_height_cm'),
  motherHeightCm: real('mother_height_cm'),
  schoolStage: text('school_stage'),
  personality: text('personality'),
  aiBackground: text('ai_background'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  childIdUnique: uniqueIndex('child_profile_child_id_unique').on(table.childId),
}));
