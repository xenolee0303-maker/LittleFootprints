import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const aiProviderConfigTable = sqliteTable('ai_provider_config', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  mode: text('mode').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  apiKeyEncrypted: text('api_key_encrypted'),
  timeoutMs: integer('timeout_ms'),
  maxInputTokens: integer('max_input_tokens'),
  maxOutputTokens: integer('max_output_tokens'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
