import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const healthProfileTable = sqliteTable('health_profile', {
  childId: text('child_id').primaryKey().references(() => childTable.id, { onDelete: 'cascade' }),
  allergies: text('allergies'),
  chronicConditions: text('chronic_conditions'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const healthRecordTable = sqliteTable('health_record', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  facility: text('facility'),
  summary: text('summary'),
  followUpDate: text('follow_up_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
