import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const growthMeasurementTable = sqliteTable('growth_measurement', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
