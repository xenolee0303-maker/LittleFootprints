export type AuthorRole = 'parent' | 'child';

export interface MediaAssetInfo {
  id: string;
  kind: MediaKind;
  fileName: string;
  sizeBytes: number;
  thumbnailUnavailable: boolean;
}

export type InterestCategory = 'art' | 'sport' | 'tech' | 'reading' | 'learning' | 'life' | 'other';

export type InterestStatus = 'exploring' | 'active' | 'paused' | 'ended';

export type InterestNoteType =
  | 'practice'
  | 'milestone'
  | 'work'
  | 'competition'
  | 'reflection';

export type GrowthEventType =
  | 'travel'
  | 'competition'
  | 'performance'
  | 'gathering'
  | 'milestone'
  | 'observation'
  | 'other';

export type BloodType = 'A' | 'B' | 'AB' | 'O' | 'unknown';

export interface ChildProfile {
  childId: string;
  birthPlace: string | null; // 出生地（城市），用于真太阳时修正
  birthDate: string | null;
  birthTime: string | null;      // HH:mm
  gender: 'female' | 'male' | 'unspecified';
  bloodType: BloodType | null;
  fatherHeightCm: number | null;
  motherHeightCm: number | null;
  schoolStage: string | null;
  personality: string | null;
  aiBackground: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpsertChildProfileInput = Partial<
  Pick<ChildProfile, 'birthPlace' | 'birthDate' | 'birthTime' | 'gender' | 'bloodType' | 'fatherHeightCm' | 'motherHeightCm' | 'schoolStage' | 'personality' | 'aiBackground'>
>;

export interface GrowthMeasurement {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD
  heightCm: number | null;
  weightKg: number | null;
  headCm: number | null; // 头围
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateGrowthMeasurementInput = {
  date: string;
  heightCm?: number | null;
  weightKg?: number | null;
  headCm?: number | null;
  note?: string | null;
};

export type UpdateGrowthMeasurementInput = Partial<CreateGrowthMeasurementInput>;

export interface Interest {
  id: string;
  childId: string;
  name: string;
  category: InterestCategory;
  status: InterestStatus;
  startedAt: string; // YYYY-MM-DD
  endedAt: string | null; // YYYY-MM-DD
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterestWithNotes extends Interest {
  notes: InterestNote[];
}

export type CreateInterestInput = {
  name: string;
  category: InterestCategory;
  status?: InterestStatus;
  startedAt: string;
  endedAt?: string | null;
  description?: string | null;
};

export type UpdateInterestInput = Partial<CreateInterestInput>;

export interface InterestNote {
  id: string;
  interestId: string;
  date: string; // YYYY-MM-DD
  type: InterestNoteType;
  content: string;
  authorRole: AuthorRole;
  assets?: MediaAssetInfo[];
  createdAt: string;
  updatedAt: string;
}

export type CreateInterestNoteInput = {
  date: string;
  type: InterestNoteType;
  content: string;
  authorRole: AuthorRole;
};

export type UpdateInterestNoteInput = Partial<CreateInterestNoteInput>;

export interface GrowthEvent {
  id: string;
  type: GrowthEventType;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  location: string | null;
  description: string | null;
  participantChildIds: string[];
  authorRole: AuthorRole;
  /** Relative directory path inside the media library this event is bound to. */
  mediaDirectory: string | null;
  assets?: MediaAssetInfo[];
  createdAt: string;
  updatedAt: string;
}

export type CreateGrowthEventInput = {
  type: GrowthEventType;
  title: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  participantChildIds: string[];
  authorRole?: AuthorRole;
  mediaDirectory?: string | null;
};

export type UpdateGrowthEventInput = Partial<CreateGrowthEventInput>;

// ── Media library (fnOS photo album integration) ────────

export type MediaKind = 'image' | 'video';

export interface MediaDirectoryInfo {
  /** Relative path under the media root, e.g. "2026-08-北京旅游". */
  path: string;
  name: string;
  imageCount: number;
  videoCount: number;
  latestModifiedAt: string;
}

export interface MediaItem {
  name: string;
  kind: MediaKind;
  /** Relative file path under the media root. */
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  /** True when no thumbnail can be generated (e.g. HEIC); UI shows a placeholder. */
  thumbnailUnavailable: boolean;
}

export interface MediaStatus {
  configured: boolean;
  directoryCount: number;
}

export interface ChildWeeklySummary {
  weekStart: string;
  childSummary: { title: string; text: string; goal: string };
  generatedAt: string | null;
}

// ── Daily journal ────────────────────────────────────────

export type JournalMood = 'great' | 'good' | 'normal' | 'tired' | 'sad';

export interface DailyJournal {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD
  content: string;
  mood: JournalMood | null;
  authorRole: AuthorRole;
  assets?: MediaAssetInfo[];
  createdAt: string;
  updatedAt: string;
}

export type CreateDailyJournalInput = {
  date: string;
  content: string;
  mood?: JournalMood | null;
  authorRole: AuthorRole;
};

export type UpdateDailyJournalInput = Partial<CreateDailyJournalInput>;

// ── Health ───────────────────────────────────────────────

export interface HealthProfile {
  childId: string;
  allergies: string | null;        // 过敏源
  chronicConditions: string | null; // 基础疾病（哮喘等）
  notes: string | null;            // 其他身体情况备注
  createdAt: string;
  updatedAt: string;
}

export type UpsertHealthProfileInput = Partial<Pick<HealthProfile, 'allergies' | 'chronicConditions' | 'notes'>>;

export type HealthRecordType = 'checkup' | 'illness' | 'vaccination' | 'other';

export interface HealthRecord {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD
  type: HealthRecordType;
  title: string;
  facility: string | null;
  summary: string | null;   // 过程、诊断、医嘱、用药
  followUpDate: string | null;
  assets?: MediaAssetInfo[];
  createdAt: string;
  updatedAt: string;
}

export type CreateHealthRecordInput = {
  date: string;
  type: HealthRecordType;
  title: string;
  facility?: string | null;
  summary?: string | null;
  followUpDate?: string | null;
};

export type UpdateHealthRecordInput = Partial<CreateHealthRecordInput>;

// ── kid-study integration (read-only learning bridge) ────

export interface KidStudyBridgeStatus {
  configured: boolean;
  baseUrl: string | null;
}

export interface KidStudyChildOption {
  id: string;
  name: string;
}

export interface ChildIntegration {
  childId: string;
  kidstudyChildId: string;
  kidstudyChildName: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningCourseSummary {
  name: string;
  flowerEarned: number;
}

/** Read-only learning data pulled from a kid-study instance for one child+week. */
export interface LearningSummary {
  weekStart: string;
  scheduledCount: number;
  completedCount: number;
  incompleteCount: number;
  completionRate: number; // 0-100
  learningMinutes: number;
  flowerEarned: number;
  flowerDeducted: number;
  flowerNet: number;
  courses: LearningCourseSummary[];
}

export interface LearningSummaryResponse {
  available: boolean;
  summary?: LearningSummary;
  message?: string;
}

// ── Vaccination ──────────────────────────────────────────

export interface VaccineRecord {
  id: string;
  childId: string;
  name: string;             // 疫苗名，如 乙肝疫苗
  dose: string;             // 剂次，如 第1剂
  scheduledDate: string | null; // 应种日期（按出生日期推算）
  administeredDate: string | null; // 实际接种日期
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateVaccineRecordInput = {
  name: string;
  dose: string;
  scheduledDate?: string | null;
  administeredDate?: string | null;
  note?: string | null;
};

export type UpdateVaccineRecordInput = Partial<CreateVaccineRecordInput>;

/** One entry of the national immunization program template (months after birth). */
export interface VaccineTemplateItem {
  name: string;
  dose: string;
  monthsAfterBirth: number;
}

// ── 生辰八字（传统命理历法计算，文化趣味参考） ──────────

export interface BaziPillar {
  pillar: '年' | '月' | '日' | '时';
  ganZhi: string;
  wuXing: string;
  naYin: string;
}

export interface BaziDaYun {
  ganZhi: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  current: boolean;
}

export interface BaziResult {
  available: true;
  solarDate: string;
  birthPlace: string | null;
  trueSolarTime: string | null;  // 经度修正后的真太阳时（平太阳时近似）
  trueSolarApplied: boolean;
  lunarDate: string;
  zodiac: string;
  xingZuo: string;
  pillars: BaziPillar[];
  timeKnown: boolean;
  fiveElements: Array<{ element: string; count: number }>;
  dayMaster: string;
  dayStem: string;
  qiYun: string | null;          // 起运描述，如 出生后4年9个月起运
  daYun: BaziDaYun[];            // 大运表（时辰已知时才有）
}

export interface BaziUnavailable {
  available: false;
  reason: 'no_birth_date';
}
