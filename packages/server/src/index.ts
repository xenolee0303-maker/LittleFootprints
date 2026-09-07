import { buildApp } from './app.js';
import { createAiScheduler } from './services/ai-scheduler.js';
import { listChildren } from './services/children.js';
import { generateWeeklyReport, listReports } from './services/ai-reports.js';

let app: Awaited<ReturnType<typeof buildApp>> | undefined;
let scheduler: ReturnType<typeof createAiScheduler> | undefined;

try {
  app = await buildApp();
  await app.listen({ port: 3002, host: '0.0.0.0' });
  scheduler = createAiScheduler({
    listChildren,
    generateReport: (childId, weekStart) => generateWeeklyReport(childId, weekStart),
    listReportStatus: async (childId, weekStart) => (await listReports({ childId, weekStartFrom: weekStart, weekStartTo: weekStart }))[0]?.status,
  });
  await scheduler.start();
  const shutdown = async () => {
    scheduler?.stop();
    await app?.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.log('LittleFootprints server running on http://localhost:3002');
} catch (err) {
  scheduler?.stop();
  if (app !== undefined) {
    try {
      await app.close();
    } catch {
      // Preserve the original startup error.
    }
  }
  const message = err instanceof Error ? err.message : 'Unknown startup error';
  console.error(`Server failed to start: ${message}`);
  process.exitCode = 1;
}
