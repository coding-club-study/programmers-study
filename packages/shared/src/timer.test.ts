import { describe, expect, it } from "vitest";
import {
  createTimer,
  elapsedTimerSeconds,
  isStaleTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  timerStorageKey
} from "./timer";

const input = {
  githubId: "aryoo",
  problemId: "42576",
  title: "완주하지 못한 선수",
  url: "https://school.programmers.co.kr/learn/courses/30/lessons/42576",
  language: "Java"
};

describe("타이머", () => {
  it("사용자와 문제별 저장 키를 만든다", () => {
    expect(timerStorageKey("aryoo", "42576")).toBe("timer:aryoo:42576");
  });

  it("생성 후 새로고침 가능한 직렬화 상태를 유지한다", () => {
    const timer = createTimer(input, new Date("2026-07-31T00:00:00Z"));
    expect(JSON.parse(JSON.stringify(timer))).toEqual(timer);
  });

  it("일시정지 시간을 제외하고 재개한다", () => {
    const timer = createTimer(input, new Date("2026-07-31T00:00:00Z"));
    const paused = pauseTimer(timer, new Date("2026-07-31T00:10:00Z"));
    const resumed = resumeTimer(paused, new Date("2026-07-31T00:15:00Z"));
    expect(resumed.totalPausedSeconds).toBe(300);
    expect(elapsedTimerSeconds(resumed, new Date("2026-07-31T00:20:00Z"))).toBe(900);
  });

  it("정답 시 타이머를 종료한다", () => {
    const timer = createTimer(input, new Date("2026-07-31T00:00:00Z"));
    const solved = stopTimer(timer, new Date("2026-07-31T00:42:18Z"));
    expect(solved.status).toBe("solved");
    expect(elapsedTimerSeconds(solved)).toBe(2538);
  });

  it("12시간 이상 된 타이머를 판별한다", () => {
    const timer = createTimer(input, new Date("2026-07-30T00:00:00Z"));
    expect(isStaleTimer(timer, new Date("2026-07-30T12:00:00Z"))).toBe(true);
  });

  it("새 타이머 생성으로 초기화한다", () => {
    const first = createTimer(input, new Date("2026-07-30T00:00:00Z"));
    const reset = createTimer(input, new Date("2026-07-31T00:00:00Z"));
    expect(reset.startedAt).not.toBe(first.startedAt);
    expect(reset.totalPausedSeconds).toBe(0);
  });
});
