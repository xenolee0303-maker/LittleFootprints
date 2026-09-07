/** Weekly AI report scheduler.
 *
 * The scheduler deliberately has no database knowledge.  This keeps the
 * compensation/idempotency rules testable and lets the server provide the
 * existing child/report services as dependencies.
 */

export type AiReportScheduleStatus = 'pending' | 'ready' | 'failed' | 'stale' | string;

export interface AiSchedulerOptions {
  now?: () => Date | string;
  listChildren: () => Promise<ReadonlyArray<{ id: string }>>;
  generateReport: (childId: string, weekStart: string) => Promise<unknown>;
  listReportStatus: (childId: string, weekStart: string) => Promise<AiReportScheduleStatus | undefined>;
  setTimeout?: (handler: () => void, timeout: number) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout?: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
  logger?: { error?: (error: unknown, context?: string) => void };
}

export interface AiScheduler {
  start(): Promise<void>;
  stop(): void;
  runNow(weekStart?: string): Promise<void>;
}

const TIME_ZONE = 'Asia/Shanghai';
const SUNDAY = 0;
const REPORT_HOUR = 20;
const MAX_TIMEOUT = 2_147_483_647;

interface LocalParts { year: number; month: number; day: number; weekday: number; hour: number; minute: number; second: number; }

function partsAt(date: Date): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(value('year')), month: Number(value('month')), day: Number(value('day')), weekday: weekdays[value('weekday')] ?? 0, hour: Number(value('hour')) % 24, minute: Number(value('minute')), second: Number(value('second')) };
}

function dateKey(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function addDays(year: number, month: number, day: number, amount: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + amount));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function weekStartForCompletedWeek(date: Date): string {
  const local = partsAt(date);
  const currentMondayOffset = local.weekday === SUNDAY ? -6 : 1 - local.weekday;
  const completedWeekOffset = local.weekday === SUNDAY && local.hour >= REPORT_HOUR ? currentMondayOffset : currentMondayOffset - 7;
  const [year, month, day] = addDays(local.year, local.month, local.day, completedWeekOffset);
  return dateKey(year, month, day);
}

function nextSunday20(date: Date): Date {
  const local = partsAt(date);
  let days = (SUNDAY - local.weekday + 7) % 7;
  // At exactly 20:00 the weekly run is considered due, so a timer armed
  // immediately after it must target the following Sunday rather than fire
  // again in a millisecond.
  if (days === 0 && local.hour >= REPORT_HOUR) days = 7;
  const [year, month, day] = addDays(local.year, local.month, local.day, days);
  // Shanghai has no DST and is UTC+08:00. Constructing the instant explicitly
  // avoids relying on the host machine's timezone.
  return new Date(Date.UTC(year, month - 1, day, REPORT_HOUR - 8, 0, 0, 0));
}

function asDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('scheduler now() returned an invalid date');
  return date;
}

export function createAiScheduler(options: AiSchedulerOptions): AiScheduler {
  const now = options.now ?? (() => new Date());
  const scheduleTimer = options.setTimeout ?? ((handler, timeout) => globalThis.setTimeout(handler, timeout));
  const cancelTimer = options.clearTimeout ?? ((timer) => globalThis.clearTimeout(timer));
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let started = false;
  let stopping = false;
  const inFlight = new Set<string>();

  async function runChild(childId: string, weekStart: string): Promise<void> {
    const key = `${childId}:${weekStart}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      const status = await options.listReportStatus(childId, weekStart);
      // Pending is also skipped: a process restart must not create a second
      // report while the previous generation is still in progress.
      if (status === 'ready' || status === 'pending') return;
      await options.generateReport(childId, weekStart);
    } catch (error) {
      // One child's provider/database failure must never prevent other
      // children from receiving a report.
      options.logger?.error?.(error, 'ai_report_generation_failed');
    } finally {
      inFlight.delete(key);
    }
  }

  async function runNow(weekStart = weekStartForCompletedWeek(asDate(now()))): Promise<void> {
    const children = await options.listChildren();
    await Promise.all(children.map((child) => runChild(child.id, weekStart)));
  }

  function arm(): void {
    if (stopping) return;
    const current = asDate(now());
    const target = nextSunday20(current);
    let delay = target.getTime() - current.getTime();
    if (delay <= 0) delay = 1;
    // setTimeout is limited on some runtimes; this guard also makes the
    // scheduler safe if the timezone implementation is ever changed.
    delay = Math.min(delay, MAX_TIMEOUT);
    timer = scheduleTimer(() => {
      timer = undefined;
      void runNow().finally(() => arm());
    }, delay);
  }

  return {
    async start() {
      if (started) return;
      started = true;
      stopping = false;
      await runNow();
      arm();
    },
    stop() {
      stopping = true;
      started = false;
      if (timer !== undefined) {
        cancelTimer(timer);
        timer = undefined;
      }
    },
    runNow,
  };
}

export const aiSchedulerTimeZone = TIME_ZONE;
