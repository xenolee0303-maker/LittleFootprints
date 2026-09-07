import type { FastifyInstance } from 'fastify';
import * as reports from '../services/ai-reports.js';
import type { AiReportFailureCode } from '@bloommate/shared';

function errorStatus(error: unknown, failureCode?: AiReportFailureCode): number {
  if (failureCode === 'input_too_large') return 413;
  if (failureCode === 'provider_invalid_request') return 400;
  if (failureCode === 'provider_authentication' || failureCode === 'provider_timeout' || failureCode === 'provider_rate_limited' || failureCode === 'provider_unavailable' || failureCode === 'provider_not_configured') return 503;
  if (failureCode === 'invalid_json' || failureCode === 'invalid_schema' || failureCode === 'invalid_evidence' || failureCode === 'repair_failed') return 502;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('provider')) return 503;
  if (message.includes('weekStart') || message.includes('required')) return 400;
  return 500;
}
export async function aiReportsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/ai/reports', async (request, reply) => {
    const query = request.query as { child_id?: string; week_start_from?: string; week_start_to?: string; status?: string };
    if (!query.child_id) return reply.status(400).send({ message: 'child_id is required' });
    return { reports: await reports.listReports({ childId: query.child_id, weekStartFrom: query.week_start_from, weekStartTo: query.week_start_to, status: query.status }) };
  });
  app.get('/api/ai/reports/:id', async (request, reply) => {
    const result = await reports.getReport((request.params as { id: string }).id);
    if (!result) return reply.status(404).send({ message: 'Not found' });
    const childId = (request.query as { child_id?: string }).child_id;
    if (!childId) return reply.status(400).send({ message: 'child_id is required' });
    if (childId !== result.report.childId) return reply.status(403).send({ message: '无权访问该孩子的报告' });
    return result;
  });
  app.post('/api/ai/reports/generate', async (request, reply) => {
    const body = request.body as { childId?: string; child_id?: string; weekStart?: string; week_start?: string; providerId?: string };
    try {
      const result = await reports.generateWeeklyReport(body.childId ?? body.child_id ?? '', body.weekStart ?? body.week_start ?? '', { providerId: body.providerId });
      return reply.status(201).send(result);
    } catch (error) {
      const failure = reports.getAiReportFailure(error);
      return reply.status(errorStatus(error, failure?.failureCode)).send({ message: error instanceof Error ? error.message : '生成报告失败', failureCode: failure?.failureCode ?? null, failureStage: failure?.failureStage ?? null });
    }
  });
  app.post('/api/ai/reports/:id/refresh', async (request, reply) => {
    try {
      const current = await reports.getReport((request.params as { id: string }).id);
      const childId = (request.body as { childId?: string; child_id?: string } | undefined)?.childId ?? (request.body as { childId?: string; child_id?: string } | undefined)?.child_id;
      if (!current) return reply.status(404).send({ message: 'Not found' });
      if (!childId) return reply.status(400).send({ message: 'childId is required' });
      if (childId !== current.report.childId) return reply.status(403).send({ message: '无权访问该孩子的报告' });
      return reply.status(201).send(await reports.refreshReport((request.params as { id: string }).id));
    }
    catch (error) {
      const failure = reports.getAiReportFailure(error);
      return reply.status(errorStatus(error, failure?.failureCode)).send({ message: error instanceof Error ? error.message : '刷新报告失败', failureCode: failure?.failureCode ?? null, failureStage: failure?.failureStage ?? null });
    }
  });
}
