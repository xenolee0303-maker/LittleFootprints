import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { childTable } from './child.js';

// The two tables form a deliberate cycle: reports point at their current immutable revision.
export let aiAnalysisReportTable: any;
export const aiAnalysisReportRevisionTable = sqliteTable('ai_analysis_report_revision', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => aiAnalysisReportTable.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  payloadJson: text('payload_json').notNull(),
  snapshotJson: text('snapshot_json'),
  parentReportJson: text('parent_report_json'),
  childReportJson: text('child_report_json'),
  provider: text('provider'),
  model: text('model'),
  promptVersion: text('prompt_version'),
  generatedAt: text('generated_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({ reportRevisionUnique: uniqueIndex('ai_analysis_report_revision_report_revision_unique').on(table.reportId, table.revision) }));
aiAnalysisReportTable = sqliteTable('ai_analysis_report', {
  id: text('id').primaryKey(),
  childId: text('child_id').notNull().references(() => childTable.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(),
  status: text('status').notNull(),
  currentRevisionId: text('current_revision_id').references(() => aiAnalysisReportRevisionTable.id, { onDelete: 'set null' }),
  dataUpdatedAt: text('data_updated_at'),
  failureCode: text('failure_code'),
  failureStage: text('failure_stage'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({ childWeekUnique: uniqueIndex('ai_analysis_report_child_week_unique').on(table.childId, table.weekStart) }));
export const aiSavedConversationTable = sqliteTable('ai_saved_conversation', {
  id: text('id').primaryKey(),
  childId: text('child_id').references(() => childTable.id, { onDelete: 'cascade' }),
  title: text('title'),
  contextJson: text('context_json'),
  messagesJson: text('messages_json').notNull(),
  evidenceJson: text('evidence_json'),
  provider: text('provider'),
  model: text('model'),
  savedAt: text('saved_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
