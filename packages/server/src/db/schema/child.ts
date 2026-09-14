import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const childTable = sqliteTable('child', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gender: text('gender').notNull().default('unspecified'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
