import { createHash, randomBytes } from 'node:crypto';

export interface SessionStoreOptions {
  ttlMs: number;
  now: () => number;
}

export interface CreatedSession {
  token: string;
  expiresAt: number;
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class SessionStore {
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #sessions = new Map<string, number>();

  constructor({ ttlMs, now }: SessionStoreOptions) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('ttlMs must be finite and greater than 0');
    }

    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  create(): CreatedSession {
    const now = this.#readNow();
    const expiresAt = now + this.#ttlMs;

    if (!Number.isFinite(expiresAt)) {
      throw new Error('expiresAt must be finite');
    }

    const token = randomBytes(32).toString('hex');
    this.#sessions.set(digestToken(token), expiresAt);
    return { token, expiresAt };
  }

  has(token: string): boolean {
    const now = this.#readNow();

    for (const [digest, expiresAt] of this.#sessions) {
      if (expiresAt <= now) {
        this.#sessions.delete(digest);
      }
    }

    return this.#sessions.has(digestToken(token));
  }

  revoke(token: string): void {
    this.#sessions.delete(digestToken(token));
  }

  storedDigests(): readonly string[] {
    return Object.freeze([...this.#sessions.keys()]);
  }

  #readNow(): number {
    const now = this.#now();

    if (!Number.isFinite(now)) {
      throw new Error('now must return a finite number');
    }

    return now;
  }
}
