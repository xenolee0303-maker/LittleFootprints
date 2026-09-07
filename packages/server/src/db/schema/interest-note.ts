import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { interestTable } from './interest.js';

export const interestNoteTable = sqliteTable('interest_note', {
  id: text('id').primaryKey(),
  interestId: text('interest_id').notNull().references(() => interestTable.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  authorRole: text('author_role').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
