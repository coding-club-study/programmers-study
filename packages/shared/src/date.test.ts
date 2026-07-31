import { describe, expect, it } from "vitest";
import {
  calculateStreak,
  createStreakCells,
  formatDuration,
  summarizeDay,
  summarizeMonth,
  toSeoulDateKey
} from "./date";
import type { DayRecord, ProblemRecord } from "./types";

function problem(id: string, date: string, seconds = 60): ProblemRecord {
  return {
    problemId: id,
    title: `문제 ${id}`,
    url: `https://school.programmers.co.kr/learn/courses/30/lessons/${id}`,
    language: "Java",
    startedAt: `${date}T00:00:00+09:00`,
    solvedAt: `${date}T00:01:00+09:00`,
    durationSeconds: seconds,
    durationEdited: false,
    source: "chrome-extension"
  };
}

function day(date: string, count = 1): DayRecord {
  return { reflection: "", problems: Array.from({ length: count }, (_, index) => problem(`${date}-${index}`, date)) };
}

describe("서울 날짜와 표시", () => {
  it("UTC 시각을 서울 날짜로 변환한다", () => {
    expect(toSeoulDateKey("2026-07-30T15:30:00Z")).toBe("2026-07-31");
  });

  it.each([
    [45, "45초"],
    [492, "8분 12초"],
    [4440, "1시간 14분"],
    [7388, "2시간 3분 8초"]
  ])("%i초를 표시한다", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("대시보드 집계", () => {
  const days = {
    "2026-07-01": day("2026-07-01", 2),
    "2026-07-02": day("2026-07-02", 1),
    "2026-08-01": day("2026-08-01", 1)
  };

  it("오늘 문제 수와 총 시간을 계산한다", () => {
    expect(summarizeDay(days["2026-07-01"])).toMatchObject({ problemCount: 2, durationSeconds: 120 });
  });

  it("월간 문제 수, 시간, 완료 일수를 계산한다", () => {
    expect(summarizeMonth(days, "2026-07")).toEqual({
      problemCount: 3,
      durationSeconds: 180,
      completedDays: 2
    });
  });
});

describe("스트릭", () => {
  it("오늘까지 이어진 현재 스트릭과 최고 스트릭을 계산한다", () => {
    const days = {
      "2026-07-27": day("2026-07-27"),
      "2026-07-29": day("2026-07-29"),
      "2026-07-30": day("2026-07-30"),
      "2026-07-31": day("2026-07-31")
    };
    expect(calculateStreak(days, new Date("2026-07-31T03:00:00Z"))).toEqual({
      current: 3,
      best: 3,
      awaitingToday: false
    });
  });

  it("오늘 미완료지만 어제까지 이어지면 대기 상태를 유지한다", () => {
    const days = { "2026-07-29": day("2026-07-29"), "2026-07-30": day("2026-07-30") };
    expect(calculateStreak(days, new Date("2026-07-31T03:00:00Z"))).toEqual({
      current: 2,
      best: 2,
      awaitingToday: true
    });
  });

  it("36개의 라벨 없는 스트릭 셀 데이터를 만든다", () => {
    const cells = createStreakCells({ "2026-07-31": day("2026-07-31", 4) }, 36, new Date("2026-07-31T03:00:00Z"));
    expect(cells).toHaveLength(36);
    expect(cells.at(-1)).toMatchObject({ dateKey: "2026-07-31", problemCount: 4, level: 3, isToday: true });
  });
});
