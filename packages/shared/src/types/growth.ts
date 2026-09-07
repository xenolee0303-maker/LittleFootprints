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

export interface ChildProfile {
  childId: string;
  birthDate: string | null;
  schoolStage: string | null;
  personality: string | null;
  aiBackground: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpsertChildProfileInput = Partial<
  Pick<ChildProfile, 'birthDate' | 'schoolStage' | 'personality' | 'aiBackground'>
>;

export interface GrowthMeasurement {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD
  heightCm: number | null;
  weightKg: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateGrowthMeasurementInput = {
  date: string;
  heightCm?: number | null;
  weightKg?: number | null;
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
