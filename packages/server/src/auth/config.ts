export interface AuthConfig {
  authRequired: boolean;
  familyPin?: string;
  sessionTtlMs: number;
  maxFailedAttempts: number;
  lockoutMs: number;
  secureCookie: boolean;
  now: () => number;
}

export type AuthConfigOverrides = Partial<AuthConfig>;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const FAMILY_PIN_PATTERN = /^\d{6}$/;

function requireFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be finite and greater than 0`);
  }
}

export function resolveAuthConfig(
  env: Record<string, string | undefined>,
  nodeEnv: string | undefined,
  overrides: AuthConfigOverrides = {},
): AuthConfig {
  const authRequired = overrides.authRequired ?? nodeEnv !== 'test';
  const familyPin = overrides.familyPin ?? env.FAMILY_PIN;
  const sessionTtlMs = overrides.sessionTtlMs === undefined ? THIRTY_DAYS_MS : overrides.sessionTtlMs;
  const maxFailedAttempts = overrides.maxFailedAttempts === undefined ? 5 : overrides.maxFailedAttempts;
  const lockoutMs = overrides.lockoutMs === undefined ? FIFTEEN_MINUTES_MS : overrides.lockoutMs;
  const now = overrides.now === undefined ? Date.now : overrides.now;

  if (authRequired && !FAMILY_PIN_PATTERN.test(familyPin ?? '')) {
    throw new Error('FAMILY_PIN must be exactly 6 digits when authentication is required');
  }

  requireFinitePositive(sessionTtlMs, 'sessionTtlMs');
  requireFinitePositive(lockoutMs, 'lockoutMs');

  if (!Number.isFinite(maxFailedAttempts) || !Number.isInteger(maxFailedAttempts) || maxFailedAttempts <= 0) {
    throw new Error('maxFailedAttempts must be a finite positive integer');
  }

  if (typeof now !== 'function') {
    throw new Error('now must be a function');
  }

  return {
    authRequired,
    familyPin,
    sessionTtlMs,
    maxFailedAttempts,
    lockoutMs,
    secureCookie: overrides.secureCookie ?? false,
    now,
  };
}
