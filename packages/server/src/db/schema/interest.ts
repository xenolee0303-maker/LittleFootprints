import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const interestTable = sqliteTable('interest', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
