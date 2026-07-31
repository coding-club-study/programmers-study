import { describe, expect, it } from "vitest";
import {
  DuplicateProblemError,
  assertUserOwnsFile,
  createUserData,
  mergeProblem
} from "./records";
import type { ProblemRecord } from "./types";

const profile = { login: "aryoo", name: "유아름", avatar_url: "https://github.com/aryoo.png" };

function problem(id: string, solvedAt = "2026-07-31T09:54:18+09:00"): ProblemRecord {
  return {
    problemId: id,
    title: `문제 ${id}`,
    url: `https://school.programmers.co.kr/learn/courses/30/lessons/${id}`,
    language: "Java",
    startedAt: "2026-07-31T09:12:00+09:00",
    solvedAt,
    durationSeconds: 2538,
    durationEdited: false,
    source: "chrome-extension"
  };
}

describe("사용자 기록 병합", () => {
  it("첫 업로드용 사용자 JSON을 만든다", () => {
    expect(createUserData(profile, new Date("2026-07-31T00:00:00+09:00"))).toMatchObject({
      githubId: "aryoo",
      displayName: "유아름",
      joinedAt: "2026-07-31",
      days: {}
    });
  });

  it("같은 날짜의 첫 문제와 소감을 추가한다", () => {
    const merged = mergeProblem(createUserData(profile), problem("42576"), "오늘의 소감");
    expect(merged.days["2026-07-31"]?.problems).toHaveLength(1);
    expect(merged.days["2026-07-31"]?.reflection).toBe("오늘의 소감");
  });

  it("같은 날짜의 두 번째 문제를 병합하고 기존 소감을 유지한다", () => {
    const first = mergeProblem(createUserData(profile), problem("42576"), "기존 소감");
    const second = mergeProblem(first, problem("12906"), "바뀐 소감");
    expect(second.days["2026-07-31"]?.problems).toHaveLength(2);
    expect(second.days["2026-07-31"]?.reflection).toBe("기존 소감");
  });

  it("요청 시 기존 소감을 수정한다", () => {
    const first = mergeProblem(createUserData(profile), problem("42576"), "기존 소감");
    const second = mergeProblem(first, problem("12906"), "수정 소감", { updateReflection: true });
    expect(second.days["2026-07-31"]?.reflection).toBe("수정 소감");
  });

  it("다른 날짜 기록을 추가한다", () => {
    const first = mergeProblem(createUserData(profile), problem("42576"), "");
    const second = mergeProblem(first, problem("42576", "2026-08-01T10:00:00+09:00"), "");
    expect(Object.keys(second.days)).toHaveLength(2);
  });

  it("동일 날짜 동일 문제의 중복을 막는다", () => {
    const first = mergeProblem(createUserData(profile), problem("42576"), "");
    expect(() => mergeProblem(first, problem("42576"), "")).toThrow(DuplicateProblemError);
  });

  it("수정된 풀이 시간 필드를 유지한다", () => {
    const edited = { ...problem("42576"), durationSeconds: 2000, durationEdited: true, originalDurationSeconds: 2538 };
    const result = mergeProblem(createUserData(profile), edited, "");
    expect(result.days["2026-07-31"]?.problems[0]).toMatchObject({
      durationSeconds: 2000,
      durationEdited: true,
      originalDurationSeconds: 2538
    });
  });

  it("인증 사용자와 파일 사용자가 다르면 거부한다", () => {
    expect(() => assertUserOwnsFile("aryoo", "someone")).toThrow(/일치하지 않습니다/);
  });
});
