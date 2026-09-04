import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSolve, TimerState } from "@coding-club/shared";
import {
  completePendingUpload,
  findPending,
  findPendingForProblem,
  LAST_UPLOAD_KEY,
  pendingStorageKey
} from "./storage";

function makePending(problemId: string, createdAt: string): PendingSolve {
  return {
    githubId: "aryoo",
    reflection: "",
    createdAt,
    problem: {
      problemId,
      title: `문제 ${problemId}`,
      url: `https://school.programmers.co.kr/learn/courses/30/lessons/${problemId}`,
      language: "Java",
      startedAt: "2026-09-04T06:00:00.000Z",
      solvedAt: "2026-09-04T06:10:00.000Z",
      durationSeconds: 600,
      durationEdited: false,
      source: "chrome-extension"
    }
  };
}

describe("확장 프로그램 로컬 업로드 상태", () => {
  let stored: Record<string, unknown>;
  let operations: string[];
  let afterSet: (() => void) | undefined;

  beforeEach(() => {
    stored = {};
    operations = [];
    afterSet = undefined;
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string | null) => {
            if (key === null) return { ...stored };
            return { [key]: stored[key] };
          }),
          set: vi.fn(async (values: Record<string, unknown>) => {
            operations.push("set");
            Object.assign(stored, values);
            afterSet?.();
          }),
          remove: vi.fn(async (key: string) => {
            operations.push("remove");
            delete stored[key];
          })
        }
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("대기 기록을 생성 시각과 키 순서로 정렬한다", async () => {
    const later = makePending("2", "2026-09-04T07:00:00.000Z");
    const earlierB = makePending("3", "2026-09-04T06:00:00.000Z");
    const earlierA = makePending("1", "2026-09-04T06:00:00.000Z");
    stored[pendingStorageKey("aryoo", "2")] = later;
    stored[pendingStorageKey("aryoo", "3")] = earlierB;
    stored[pendingStorageKey("aryoo", "1")] = earlierA;

    const result = await findPending();

    expect(result.map(({ value }) => value.problem.problemId)).toEqual(["1", "3", "2"]);
  });

  it("기존 키와 새 고유 키 중 같은 문제의 최신 pending을 찾는다", async () => {
    const legacy = makePending("42576", "2026-09-03T06:00:00.000Z");
    const latest = makePending("42576", "2026-09-04T06:00:00.000Z");
    stored[pendingStorageKey("aryoo", "42576")] = legacy;
    const latestKey = pendingStorageKey("aryoo", "42576", latest.createdAt);
    stored[latestKey] = latest;

    await expect(findPendingForProblem("aryoo", "42576")).resolves.toEqual({ key: latestKey, value: latest });
  });

  it("성공한 업로드의 타이머와 마지막 업로드를 기록한 뒤 pending을 제거한다", async () => {
    const pending = makePending("42576", "2026-09-04T06:10:00.000Z");
    const timerKey = "timer:aryoo:42576";
    const timer: TimerState = {
      githubId: "aryoo",
      problemId: "42576",
      title: pending.problem.title,
      url: pending.problem.url,
      language: "Java",
      startedAt: pending.problem.startedAt,
      pausedAt: null,
      totalPausedSeconds: 0,
      status: "solved",
      solvedAt: pending.problem.solvedAt
    };
    stored[timerKey] = timer;
    const pendingKey = pendingStorageKey("aryoo", "42576", pending.createdAt);
    stored[pendingKey] = pending;

    await completePendingUpload(pendingKey, pending, "success", new Date("2026-09-04T07:00:00.000Z"));

    expect(stored[timerKey]).toMatchObject({ status: "uploaded" });
    expect(stored[LAST_UPLOAD_KEY]).not.toBe("이미 등록된 기록");
    expect(stored[pendingKey]).toBeUndefined();
    expect(operations).toEqual(["set", "remove"]);
  });

  it("이미 등록된 기록도 pending에서 안전하게 정리한다", async () => {
    const pending = makePending("42576", "2026-09-04T06:10:00.000Z");
    const pendingKey = pendingStorageKey("aryoo", "42576");
    stored[pendingKey] = pending;

    await completePendingUpload(pendingKey, pending, "duplicate");

    expect(stored[LAST_UPLOAD_KEY]).toBe("이미 등록된 기록");
    expect(stored[pendingKey]).toBeUndefined();
  });

  it("업로드 중 같은 문제의 더 새로운 pending이 생겨도 정확한 이전 키만 삭제한다", async () => {
    const uploaded = makePending("42576", "2026-09-04T06:10:00.000Z");
    const newer = makePending("42576", "2026-09-05T06:10:00.000Z");
    const uploadedKey = pendingStorageKey("aryoo", "42576", uploaded.createdAt);
    const newerKey = pendingStorageKey("aryoo", "42576", newer.createdAt);
    stored[uploadedKey] = uploaded;
    stored[newerKey] = newer;

    await completePendingUpload(uploadedKey, uploaded, "success", new Date("2026-09-04T07:00:00.000Z"));

    expect(stored[uploadedKey]).toBeUndefined();
    expect(stored[newerKey]).toEqual(newer);
    expect(operations).toEqual(["set", "remove"]);
  });

  it("완료 상태 저장 중 exact pending이 편집되면 갱신된 기록을 보존한다", async () => {
    const pending = makePending("42576", "2026-09-04T06:10:00.000Z");
    const key = pendingStorageKey("aryoo", "42576", pending.createdAt);
    stored[key] = pending;
    afterSet = () => {
      stored[key] = { ...pending, reflection: "업로드 중 수정된 소감" };
      afterSet = undefined;
    };

    await completePendingUpload(key, pending, "success", new Date("2026-09-04T07:00:00.000Z"));

    expect(stored[key]).toMatchObject({ reflection: "업로드 중 수정된 소감" });
    expect(operations).toEqual(["set"]);
  });
});
