import { db } from '../db/index.js';
import { appSettingTable, childIntegrationTable } from '../db/schema/integration.js';
import { eq } from 'drizzle-orm';
import type {
  KidStudyBridgeStatus,
  KidStudyChildOption,
  ChildIntegration,
  LearningSummary,
  LearningSummaryResponse,
} from '@littlefootprints/shared';
import { childExists } from './child-profile.js';
import { encryptSecret, decryptSecret } from './ai-provider-config.js';

const SETTING_BASE_URL = 'kidstudy.baseUrl';
const SETTING_PIN = 'kidstudy.pinEncrypted';
const LOGIN_TIMEOUT_MS = 6_000;
const FETCH_TIMEOUT_MS = 6_000;

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(appSettingTable).where(eq(appSettingTable.key, key)).get();
  return row?.value ?? null;
}

async function putSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingTable)
    .values({ key, value, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: appSettingTable.key, set: { value, updatedAt: nowIso() } })
    .run();
}

export async function getBridgeStatus(): Promise<KidStudyBridgeStatus> {
  const baseUrl = await getSetting(SETTING_BASE_URL);
  return { configured: baseUrl !== null, baseUrl: baseUrl ?? null };
}

/** Saves base URL; PIN is encrypted at rest. Omit pin to keep the stored one. */
export async function saveBridgeConfig(baseUrl: string, pin?: string): Promise<void> {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  await putSetting(SETTING_BASE_URL, normalized);
  if (pin !== undefined && pin !== '') {
    await putSetting(SETTING_PIN, encryptSecret(pin));
  }
}

async function getCredentials(): Promise<{ baseUrl: string; pin: string } | null> {
  const baseUrl = await getSetting(SETTING_BASE_URL);
  const pinEncrypted = await getSetting(SETTING_PIN);
  if (!baseUrl || !pinEncrypted) return null;
  try {
    return { baseUrl, pin: decryptSecret(pinEncrypted) };
  } catch {
    return null;
  }
}

interface KidStudySession {
  cookie: string;
}

async function login(baseUrl: string, pin: string): Promise<KidStudySession> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BridgeError(`学习系统登录失败（${response.status}）`, 502);
    }
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
      throw new BridgeError('学习系统未返回会话', 502);
    }
    const cookie = setCookie.split(';')[0].trim();
    return { cookie };
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError('无法连接学习系统', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function bridgeGet<T>(baseUrl: string, session: KidStudySession, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: session.cookie },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BridgeError(`学习系统请求失败（${path} ${response.status}）`, 502);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError('无法连接学习系统', 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function listKidStudyChildren(): Promise<KidStudyChildOption[]> {
  const credentials = await getCredentials();
  if (!credentials) throw new BridgeError('学习系统联动未配置', 400);
  const session = await login(credentials.baseUrl, credentials.pin);
  const children = await bridgeGet<Array<{ id: string; name: string }>>(
    credentials.baseUrl,
    session,
    '/api/children',
  );
  return children.map((child) => ({ id: child.id, name: child.name }));
}

export async function testBridgeConnection(): Promise<{ ok: true; children: number } | { ok: false; message: string }> {
  try {
    const children = await listKidStudyChildren();
    return { ok: true, children: children.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '连接失败' };
  }
}

// ── Child mapping ────────────────────────────────────────

export async function getChildIntegration(childId: string): Promise<ChildIntegration | null> {
  return db.select().from(childIntegrationTable).where(eq(childIntegrationTable.childId, childId)).get() ?? null;
}

export async function setChildIntegration(childId: string, kidstudyChildId: string, kidstudyChildName: string): Promise<ChildIntegration | null> {
  if (!(await childExists(childId))) return null;
  const now = nowIso();
  const row: ChildIntegration = { childId, kidstudyChildId, kidstudyChildName, createdAt: now, updatedAt: now };
  await db
    .insert(childIntegrationTable)
    .values(row)
    .onConflictDoUpdate({
      target: childIntegrationTable.childId,
      set: { kidstudyChildId, kidstudyChildName, updatedAt: now },
    })
    .run();
  return row;
}

export async function clearChildIntegration(childId: string): Promise<boolean> {
  const result = await db.delete(childIntegrationTable).where(eq(childIntegrationTable.childId, childId)).run();
  return result.changes > 0;
}

// ── Learning summary ─────────────────────────────────────

interface KidStudyScheduleEntry {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface KidStudyFlowerComparison {
  current?: { earned?: number; deducted?: number; net?: number };
  courses?: Array<{ activityName?: string; currentEarned?: number }>;
}

function entryMinutes(entry: KidStudyScheduleEntry): number {
  const [sh, sm] = entry.startTime.split(':').map(Number);
  const [eh, em] = entry.endTime.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export async function fetchLearningSummary(childId: string, weekStart: string): Promise<LearningSummaryResponse> {
  try {
    const credentials = await getCredentials();
    if (!credentials) return { available: false, message: '未配置学习系统联动' };
    const mapping = await getChildIntegration(childId);
    if (!mapping) return { available: false, message: '该孩子未关联学习系统' };

    const session = await login(credentials.baseUrl, credentials.pin);
    const week = await bridgeGet<{ entries?: KidStudyScheduleEntry[] }>(
      credentials.baseUrl,
      session,
      `/api/schedules/week?date=${encodeURIComponent(weekStart)}&child_id=${encodeURIComponent(mapping.kidstudyChildId)}`,
    );
    const flowers = await bridgeGet<KidStudyFlowerComparison>(
      credentials.baseUrl,
      session,
      `/api/flower-statistics/weekly-comparison?child_id=${encodeURIComponent(mapping.kidstudyChildId)}&week_start=${encodeURIComponent(weekStart)}`,
    );

    const entries = week.entries ?? [];
    const penalized = new Set(['absent', 'cancelled']);
    const eligible = entries.filter((entry) => !penalized.has(entry.status));
    const completed = entries.filter((entry) => entry.status === 'completed');
    const learningMinutes = completed.reduce((total, entry) => total + entryMinutes(entry), 0);

    const summary: LearningSummary = {
      weekStart,
      scheduledCount: entries.length,
      completedCount: completed.length,
      incompleteCount: entries.filter((entry) => entry.status === 'incomplete').length,
      completionRate: eligible.length ? Math.round((completed.length / eligible.length) * 100) : 0,
      learningMinutes,
      flowerEarned: flowers.current?.earned ?? 0,
      flowerDeducted: flowers.current?.deducted ?? 0,
      flowerNet: flowers.current?.net ?? 0,
      courses: (flowers.courses ?? [])
        .filter((course) => (course.currentEarned ?? 0) > 0)
        .map((course) => ({ name: course.activityName ?? '课程', flowerEarned: course.currentEarned ?? 0 })),
    };
    return { available: true, summary };
  } catch (error) {
    // The growth report must survive an unreachable learning system.
    return { available: false, message: error instanceof Error ? error.message : '学习系统不可用' };
  }
}
