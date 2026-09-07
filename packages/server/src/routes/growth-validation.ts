export type RequestBody = Record<string, unknown>;

export function isPlainObject(value: unknown): value is RequestBody {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasOwn(body: RequestBody, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthLengths[month - 1];
}

// Accepts null, undefined or a plain string (empty string means "clear to null").
export function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function normalizeNullableText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export const INTEREST_CATEGORIES = ['art', 'sport', 'tech', 'reading', 'life', 'other'] as const;
export const INTEREST_STATUSES = ['exploring', 'active', 'paused', 'ended'] as const;
export const INTEREST_NOTE_TYPES = ['practice', 'milestone', 'work', 'competition', 'reflection'] as const;
export const GROWTH_EVENT_TYPES = [
  'travel',
  'competition',
  'performance',
  'gathering',
  'milestone',
  'observation',
  'other',
] as const;
export const AUTHOR_ROLES = ['parent', 'child'] as const;
