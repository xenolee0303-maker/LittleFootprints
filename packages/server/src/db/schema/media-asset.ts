import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { interestNoteTable } from './interest-note.js';
import { growthEventTable } from './growth-event.js';
import { dailyJournalTable } from './daily-journal.js';

// Uploaded works/process files (images and videos) attached to interest notes,
// growth events or journal entries. Exactly one owner id is set.
// Files live under data/uploads; storagePath is relative to that directory.
export const mediaAssetTable = sqliteTable('media_asset', {
  id: text('id').primaryKey(),
  noteId: text('note_id').references(() => interestNoteTable.id, { onDelete: 'cascade' }),
  eventId: text('event_id').references(() => growthEventTable.id, { onDelete: 'cascade' }),
  journalId: text('journal_id').references(() => dailyJournalTable.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull(),
});
