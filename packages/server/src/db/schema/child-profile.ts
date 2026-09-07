import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const childProfileTable = sqliteTable('child_profile', {
  childId: text('child_id').primaryKey().references(() => childTable.id, { onDelete: 'cascade' }),
  birthDate: text('birth_date'),
  schoolStage: text('school_stage'),
  personality: text('personality'),
  aiBackground: text('ai_background'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  childIdUnique: uniqueIndex('child_profile_child_id_unique').on(table.childId),
}));
