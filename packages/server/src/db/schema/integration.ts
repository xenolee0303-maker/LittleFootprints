import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

// Simple key/value store for integration credentials (PIN stored encrypted).
export const appSettingTable = sqliteTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Per-child mapping to the kid-study learning system (read-only bridge).
export const childIntegrationTable = sqliteTable('child_integration', {
  childId: text('child_id').primaryKey().references(() => childTable.id, { onDelete: 'cascade' }),
  kidstudyChildId: text('kidstudy_child_id').notNull(),
  kidstudyChildName: text('kidstudy_child_name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
