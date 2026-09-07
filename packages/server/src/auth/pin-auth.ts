import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AuthConfig } from './config.js';
import { SessionStore } from './session-store.js';

const SESSION_COOKIE = 'bloommate_session';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const PIN_PATTERN = /^\d{6}$/;
const AUTHENTICATION_REQUIRED = { message: 'Authentication required' };

interface FailedAttempts {
  count: number;
  expiresAt: number;
}

function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }

  let token: string | undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE) {
      continue;
    }

    if (token !== undefined) {
      return undefined;
    }
    token = part.slice(separator + 1).trim();
  }

  return token !== undefined && TOKEN_PATTERN.test(token) ? token : undefined;
}

function serializeSessionCookie(value: string, maxAge: number, secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

function pinsMatch(candidate: string, configuredPin: string | undefined): boolean {
  const candidateBuffer = Buffer.from(candidate, 'ascii');
  const configuredBuffer = Buffer.alloc(6);
  if (configuredPin !== undefined && PIN_PATTERN.test(configuredPin)) {
    configuredBuffer.write(configuredPin, 'ascii');
  }
  return timingSafeEqual(candidateBuffer, configuredBuffer);
}

/** Constant-time verification for sensitive, already-authenticated actions. */
export function verifyFamilyPin(candidate: string, configuredPin: string | undefined): boolean {
  if (typeof candidate !== 'string' || !PIN_PATTERN.test(candidate)) return false;
  return pinsMatch(candidate, configuredPin);
}

export function registerPinAuth(app: FastifyInstance, config: AuthConfig): void {
  const sessions = new SessionStore({ ttlMs: config.sessionTtlMs, now: config.now });
  const failedAttemptsByIp = new Map<string, FailedAttempts>();
  const cookieMaxAge = Math.max(1, Math.floor(config.sessionTtlMs / 1_000));

  // Routes may use this only for a second confirmation; login throttling remains unchanged.
  app.decorate('verifyFamilyPin', (candidate: string) => verifyFamilyPin(candidate, config.familyPin));

  function readNow(): number {
    const now = config.now();
    if (!Number.isFinite(now)) {
      throw new Error('now must return a finite number');
    }
    return now;
  }

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?', 1)[0];
    if (!config.authRequired || !path.startsWith('/api/')) {
      return;
    }
    if (path === '/api/health' || path === '/api/auth/login') {
      return;
    }

    const token = readSessionToken(request.headers.cookie);
    if (token === undefined || !sessions.has(token)) {
      await reply.status(401).send(AUTHENTICATION_REQUIRED);
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const now = readNow();
    for (const [ip, failure] of failedAttemptsByIp) {
      if (failure.expiresAt <= now) {
        failedAttemptsByIp.delete(ip);
      }
    }

    if (!config.authRequired) {
      return { authenticated: true };
    }

    const body = request.body as { pin?: unknown } | null;
    const pin = body?.pin;
    if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
      return reply.status(400).send({ message: 'PIN must be exactly 6 digits' });
    }

    const previousFailure = failedAttemptsByIp.get(request.ip);
    if (previousFailure !== undefined && previousFailure.count >= config.maxFailedAttempts) {
      return reply.status(429).send({ message: 'Too many login attempts' });
    }

    if (!pinsMatch(pin, config.familyPin)) {
      let failure = previousFailure;
      if (failure === undefined) {
        const expiresAt = now + config.lockoutMs;
        if (!Number.isFinite(expiresAt)) {
          throw new Error('lockout expiry must be finite');
        }
        failure = { count: 0, expiresAt };
      }
      failure.count += 1;
      failedAttemptsByIp.set(request.ip, failure);

      if (failure.count >= config.maxFailedAttempts) {
        return reply.status(429).send({ message: 'Too many login attempts' });
      }
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    failedAttemptsByIp.delete(request.ip);
    const { token } = sessions.create();
    reply.header('Set-Cookie', serializeSessionCookie(token, cookieMaxAge, config.secureCookie));
    return { authenticated: true };
  });

  app.get('/api/auth/status', async () => ({ authenticated: true }));

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readSessionToken(request.headers.cookie);
    if (token !== undefined) {
      sessions.revoke(token);
    }
    reply.header('Set-Cookie', serializeSessionCookie('', 0, config.secureCookie));
    return { authenticated: false };
  });
}
