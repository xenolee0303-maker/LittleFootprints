import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { interestNoteTable } from './interest-note.js';

// Uploaded works/process files (images and videos) attached to interest notes.
// Files live under data/uploads; storagePath is relative to that directory.
export const mediaAssetTable = sqliteTable('media_asset', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull().references(() => interestNoteTable.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // image | video
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull(),
});
