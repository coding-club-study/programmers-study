import { SEOUL_TIME_ZONE, type DayRecord, type StreakCell, type StreakSummary } from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function toSeoulDateKey(value: string | number | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("유효하지 않은 날짜입니다.");
  return dateFormatter.format(date);
}

export function seoulToday(now: Date = new Date()): string {
  return toSeoulDateKey(now);
}

export function addDateKeyDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) throw new Error("날짜 키는 YYYY-MM-DD 형식이어야 합니다.");
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return date.toISOString().slice(0, 10);
}

export function durationBetweenSeconds(startedAt: string, endedAt: string, pausedSeconds = 0): number {
  return Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000) - pausedSeconds);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}시간`);
  if (minutes) parts.push(`${minutes}분`);
  if (seconds || parts.length === 0) parts.push(`${seconds}초`);
  return parts.join(" ");
}

export function summarizeDay(day?: DayRecord) {
  const problems = day?.problems ?? [];
  return {
    problemCount: problems.length,
    durationSeconds: problems.reduce((sum, problem) => sum + problem.durationSeconds, 0),
    reflection: day?.reflection ?? ""
  };
}

export function summarizeMonth(days: Record<string, DayRecord>, monthKey: string) {
  const matches = Object.entries(days).filter(([dateKey]) => dateKey.startsWith(`${monthKey}-`));
  return {
    problemCount: matches.reduce((sum, [, day]) => sum + day.problems.length, 0),
    durationSeconds: matches.reduce(
      (sum, [, day]) => sum + day.problems.reduce((daySum, problem) => daySum + problem.durationSeconds, 0),
      0
    ),
    completedDays: matches.filter(([, day]) => day.problems.length > 0).length
  };
}

export function calculateStreak(days: Record<string, DayRecord>, now: Date = new Date()): StreakSummary {
  const completed = new Set(
    Object.entries(days)
      .filter(([, day]) => day.problems.length > 0)
      .map(([dateKey]) => dateKey)
  );
  const today = seoulToday(now);
  const yesterday = addDateKeyDays(today, -1);
  const awaitingToday = !completed.has(today) && completed.has(yesterday);
  let cursor = completed.has(today) ? today : awaitingToday ? yesterday : "";
  let current = 0;
  while (cursor && completed.has(cursor)) {
    current += 1;
    cursor = addDateKeyDays(cursor, -1);
  }

  const sorted = [...completed].sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const dateKey of sorted) {
    run = previous && addDateKeyDays(previous, 1) === dateKey ? run + 1 : 1;
    best = Math.max(best, run);
    previous = dateKey;
  }
  return { current, best, awaitingToday };
}

export function problemCountLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

export function createStreakCells(
  days: Record<string, DayRecord>,
  count = 36,
  now: Date = new Date()
): StreakCell[] {
  const today = seoulToday(now);
  return Array.from({ length: count }, (_, index) => {
    const dateKey = addDateKeyDays(today, index - count + 1);
    const problemCount = days[dateKey]?.problems.length ?? 0;
    return {
      dateKey,
      problemCount,
      level: problemCountLevel(problemCount),
      isToday: dateKey === today,
      isFuture: dateKey > today
    };
  });
}
