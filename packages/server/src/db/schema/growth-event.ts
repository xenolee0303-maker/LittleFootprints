import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// participantChildIds stores a JSON text array so one event can cover multiple kids (e.g. family trips).
export const growthEventTable = sqliteTable('growth_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  location: text('location'),
  description: text('description'),
  participantChildIds: text('participant_child_ids').notNull(),
  authorRole: text('author_role').notNull(),
  mediaDirectory: text('media_directory'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
