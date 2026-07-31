import { DEFAULT_STALE_TIMER_HOURS, type TimerState } from "./types";
import { durationBetweenSeconds } from "./date";

export function timerStorageKey(githubId: string, problemId: string): string {
  return `timer:${githubId}:${problemId}`;
}

export function createTimer(
  input: Pick<TimerState, "githubId" | "problemId" | "title" | "url" | "language">,
  now = new Date()
): TimerState {
  return {
    ...input,
    startedAt: now.toISOString(),
    pausedAt: null,
    totalPausedSeconds: 0,
    status: "running"
  };
}

export function pauseTimer(timer: TimerState, now = new Date()): TimerState {
  if (timer.status !== "running") return timer;
  return { ...timer, pausedAt: now.toISOString(), status: "paused" };
}

export function resumeTimer(timer: TimerState, now = new Date()): TimerState {
  if (timer.status !== "paused" || !timer.pausedAt) return timer;
  const pausedFor = durationBetweenSeconds(timer.pausedAt, now.toISOString());
  return {
    ...timer,
    pausedAt: null,
    totalPausedSeconds: timer.totalPausedSeconds + pausedFor,
    status: "running"
  };
}

export function stopTimer(timer: TimerState, now = new Date()): TimerState {
  const resumed = timer.status === "paused" ? resumeTimer(timer, now) : timer;
  return { ...resumed, status: "solved", solvedAt: now.toISOString(), pausedAt: null };
}

export function elapsedTimerSeconds(timer: TimerState, now = new Date()): number {
  const end =
    timer.solvedAt ??
    (timer.status === "paused" && timer.pausedAt ? timer.pausedAt : now.toISOString());
  return durationBetweenSeconds(timer.startedAt, end, timer.totalPausedSeconds);
}

export function isStaleTimer(timer: TimerState, now = new Date(), hours = DEFAULT_STALE_TIMER_HOURS): boolean {
  return now.getTime() - new Date(timer.startedAt).getTime() >= hours * 60 * 60 * 1000;
}
