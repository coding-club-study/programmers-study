export const SEOUL_TIME_ZONE = "Asia/Seoul";
export const REFLECTION_MAX_LENGTH = 500;
export const DEFAULT_STALE_TIMER_HOURS = 12;

export type TimerStatus = "running" | "paused" | "solved" | "uploaded";

export interface TimerState {
  githubId: string;
  problemId: string;
  title: string;
  url: string;
  language: string;
  startedAt: string;
  pausedAt: string | null;
  totalPausedSeconds: number;
  status: TimerStatus;
  solvedAt?: string;
  goalMinutes?: number;
  goalNotified?: boolean;
}

export interface ProblemRecord {
  problemId: string;
  title: string;
  url: string;
  language: string;
  startedAt: string;
  solvedAt: string;
  durationSeconds: number;
  durationEdited: boolean;
  originalDurationSeconds?: number;
  reflection?: string;
  source: "chrome-extension";
}

export interface DayRecord {
  reflection: string;
  problems: ProblemRecord[];
}

export interface UserData {
  githubId: string;
  displayName: string;
  profileImageUrl: string;
  joinedAt: string;
  days: Record<string, DayRecord>;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface RepositoryConfig {
  owner: string;
  repo: string;
  branch: string;
}

export interface ExtensionSettings extends RepositoryConfig {
  githubToken?: string;
  githubId?: string;
  displayName?: string;
  profileImageUrl?: string;
  dashboardUrl?: string;
}

export interface PendingSolve {
  githubId: string;
  problem: ProblemRecord;
  reflection: string;
  createdAt: string;
}

export interface DailySummary {
  problemCount: number;
  durationSeconds: number;
  reflection: string;
}

export interface StreakSummary {
  current: number;
  best: number;
  awaitingToday: boolean;
}

export interface StreakCell {
  dateKey: string;
  problemCount: number;
  level: 0 | 1 | 2 | 3;
  isToday: boolean;
  isFuture: boolean;
}

export type UploadResult =
  | { status: "success"; commitSha: string; data: UserData }
  | { status: "duplicate"; data: UserData };
