import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as childSchema from './schema/child.js';
import * as childProfileSchema from './schema/child-profile.js';
import * as growthMeasurementSchema from './schema/growth-measurement.js';
import * as interestSchema from './schema/interest.js';
import * as interestNoteSchema from './schema/interest-note.js';
import * as growthEventSchema from './schema/growth-event.js';
import * as mediaAssetSchema from './schema/media-asset.js';
import * as dailyJournalSchema from './schema/daily-journal.js';
import * as healthSchema from './schema/health.js';
import * as integrationSchema from './schema/integration.js';
import * as aiProviderConfigSchema from './schema/ai-provider-config.js';
import * as aiAnalysisReportSchema from './schema/ai-analysis-report.js';

const defaultDbPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../data/littlefootprints.db');
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : process.env.DATABASE_PATH ?? defaultDbPath;
if (dbPath !== ':memory:') {
  mkdirSync(dirname(dbPath), { recursive: true });
}
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const schema = {
  ...childSchema,
  ...childProfileSchema,
  ...growthMeasurementSchema,
  ...interestSchema,
  ...interestNoteSchema,
  ...growthEventSchema,
  ...mediaAssetSchema,
  ...dailyJournalSchema,
  ...healthSchema,
  ...integrationSchema,
  ...aiProviderConfigSchema,
  ...aiAnalysisReportSchema,
};

export const db = drizzle(sqlite, { schema });

// Auto-migrate on every startup (idempotent: applied migrations are recorded
// in the database; dev uses src/db/migrations, build copies them to dist/db)
{
  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');
  migrate(db, { migrationsFolder });
}
