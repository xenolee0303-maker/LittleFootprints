import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

export const vaccineRecordTable = sqliteTable('vaccine_record', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  scheduledDate: text('scheduled_date'),
  administeredDate: text('administered_date'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
