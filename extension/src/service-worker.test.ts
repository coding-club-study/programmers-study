import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSolve, UploadResult } from "@coding-club/shared";

const mocks = vi.hoisted(() => ({
  uploadPendingSolve: vi.fn(),
  verifyConnection: vi.fn(),
  completePendingUpload: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("./github", () => ({
  uploadPendingSolve: mocks.uploadPendingSolve,
  verifyConnection: mocks.verifyConnection
}));

vi.mock("./storage", () => ({
  completePendingUpload: mocks.completePendingUpload,
  getSettings: mocks.getSettings,
  saveSettings: mocks.saveSettings
}));

function makePending(problemId: string): PendingSolve {
  return {
    githubId: "aryoo",
    reflection: "",
    createdAt: `2026-09-04T06:${problemId.padStart(2, "0")}:00.000Z`,
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

function success(problemId: string): UploadResult {
  return {
    status: "success",
    commitSha: `commit-${problemId}`,
    data: {
      githubId: "aryoo",
      displayName: "aryoo",
      profileImageUrl: "avatar",
      joinedAt: "2026-09-04",
      days: {}
    }
  };
}

describe("서비스 워커 업로드 큐", () => {
  let listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({
      githubToken: "token",
      githubId: "aryoo",
      owner: "coding-club-study",
      repo: "programmers-study",
      branch: "main"
    });
    mocks.completePendingUpload.mockResolvedValue(undefined);
    const addListener = vi.fn((registered) => { listener = registered; });
    vi.stubGlobal("chrome", { runtime: { onMessage: { addListener } } });
    await import("./service-worker");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("동시에 들어온 업로드를 하나씩 끝낸 뒤 다음 작업으로 넘긴다", async () => {
    const first = makePending("1");
    const second = makePending("2");
    let finishFirst!: (result: UploadResult) => void;
    mocks.uploadPendingSolve
      .mockImplementationOnce(() => new Promise<UploadResult>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(success("2"));
    const firstResponse = vi.fn();
    const secondResponse = vi.fn();

    expect(listener({ type: "record.upload", pendingKey: "pending:aryoo:1:first", pending: first }, {}, firstResponse)).toBe(true);
    expect(listener({ type: "record.upload", pendingKey: "pending:aryoo:2:second", pending: second }, {}, secondResponse)).toBe(true);
    await vi.waitFor(() => expect(mocks.uploadPendingSolve).toHaveBeenCalledTimes(1));

    finishFirst(success("1"));
    await vi.waitFor(() => expect(mocks.uploadPendingSolve).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(secondResponse).toHaveBeenCalled());

    expect(mocks.uploadPendingSolve.mock.calls.map((call) => call[1].problem.problemId)).toEqual(["1", "2"]);
    expect(mocks.completePendingUpload.mock.calls.map((call) => call[1].problem.problemId)).toEqual(["1", "2"]);
    expect(firstResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(secondResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("한 작업의 정리 실패가 다음 업로드 큐를 막지 않는다", async () => {
    const first = makePending("1");
    const second = makePending("2");
    mocks.uploadPendingSolve.mockResolvedValueOnce(success("1")).mockResolvedValueOnce(success("2"));
    mocks.completePendingUpload.mockRejectedValueOnce(new Error("storage error")).mockResolvedValueOnce(undefined);
    const firstResponse = vi.fn();
    const secondResponse = vi.fn();

    listener({ type: "record.upload", pendingKey: "pending:aryoo:1:first", pending: first }, {}, firstResponse);
    listener({ type: "record.upload", pendingKey: "pending:aryoo:2:second", pending: second }, {}, secondResponse);
    await vi.waitFor(() => expect(secondResponse).toHaveBeenCalled());

    expect(firstResponse).toHaveBeenCalledWith({ ok: false, error: "storage error" });
    expect(secondResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("같은 pending의 동시 요청은 하나의 업로드 결과를 공유한다", async () => {
    const pending = makePending("1");
    let finishUpload!: (result: UploadResult) => void;
    mocks.uploadPendingSolve.mockImplementationOnce(() => new Promise<UploadResult>((resolve) => { finishUpload = resolve; }));
    const firstResponse = vi.fn();
    const secondResponse = vi.fn();

    const pendingKey = "pending:aryoo:1:same";
    listener({ type: "record.upload", pendingKey, pending }, {}, firstResponse);
    listener({ type: "record.upload", pendingKey, pending }, {}, secondResponse);
    await vi.waitFor(() => expect(mocks.uploadPendingSolve).toHaveBeenCalledTimes(1));
    finishUpload(success("1"));
    await vi.waitFor(() => expect(secondResponse).toHaveBeenCalled());

    expect(mocks.uploadPendingSolve).toHaveBeenCalledTimes(1);
    expect(mocks.completePendingUpload).toHaveBeenCalledTimes(1);
    expect(firstResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(secondResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
