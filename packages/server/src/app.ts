import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { healthRoutes } from './routes/health.js';
import { childrenRoutes } from './routes/children.js';
import { childProfileRoutes } from './routes/child-profile.js';
import { growthMeasurementRoutes } from './routes/growth-measurements.js';
import { interestRoutes } from './routes/interests.js';
import { growthEventRoutes } from './routes/growth-events.js';
import { mediaRoutes } from './routes/media.js';
import { assetRoutes } from './routes/assets.js';
import { journalRoutes } from './routes/journal.js';
import { healthRecordRoutes } from './routes/health-records.js';
import { integrationRoutes } from './routes/integrations.js';
import { vaccineRoutes } from './routes/vaccines.js';
import { aiProviderRoutes } from './routes/ai-provider.js';
import { aiReportsRoutes } from './routes/ai-reports.js';
import { aiConversationRoutes } from './routes/ai-conversations.js';
import { resolveAuthConfig, type AuthConfigOverrides } from './auth/config.js';
import { registerPinAuth } from './auth/pin-auth.js';

export interface BuildAppOptions {
  auth?: AuthConfigOverrides;
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
}

const DEVELOPMENT_ORIGINS = ['http://localhost:5174', 'http://127.0.0.1:5174'];

function findWebDist(): string {
  // Docker: web dist is at /app/web
  if (existsSync('/app/web')) return '/app/web';
  // Local production: relative to server dist/ directory
  const serverDir = dirname(fileURLToPath(import.meta.url));
  return resolve(serverDir, '../../web/dist');
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const authConfig = resolveAuthConfig(env, nodeEnv, options.auth);
  const app = Fastify({ logger: false });

  if (nodeEnv === 'development') {
    await app.register(cors, {
      origin: DEVELOPMENT_ORIGINS,
      credentials: true,
    });
  }

  await app.register(healthRoutes);
  registerPinAuth(app, authConfig);
  await app.register(childrenRoutes);
  await app.register(childProfileRoutes);
  await app.register(growthMeasurementRoutes);
  await app.register(interestRoutes);
  await app.register(growthEventRoutes);
  await app.register(multipart, { limits: { files: 1 } });
  await app.register(mediaRoutes);
  await app.register(assetRoutes);
  await app.register(journalRoutes);
  await app.register(healthRecordRoutes);
  await app.register(integrationRoutes);
  await app.register(vaccineRoutes);
  await app.register(aiProviderRoutes);
  await app.register(aiReportsRoutes);
  await app.register(aiConversationRoutes);

  // Serve frontend static files in production
  const webDist = findWebDist();
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  }

  return app;
}
