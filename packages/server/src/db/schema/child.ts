import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const childTable = sqliteTable('child', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
