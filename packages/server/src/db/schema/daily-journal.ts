import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

// Lightweight daily entries: text + mood + optional media attachments.
export const dailyJournalTable = sqliteTable('daily_journal', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  content: text('content').notNull(),
  mood: text('mood'),
  authorRole: text('author_role').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  childDateIdx: index('daily_journal_child_date_idx').on(table.childId, table.date),
}));
