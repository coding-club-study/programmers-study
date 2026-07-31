import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionSettings, PendingSolve } from "@coding-club/shared";
import { GitHubApiError, uploadPendingSolve } from "./github";

const settings: ExtensionSettings = {
  githubToken: "test-token",
  githubId: "aryoo",
  owner: "aryoo",
  repo: "coding-study",
  branch: "main"
};

const pending: PendingSolve = {
  githubId: "aryoo",
  reflection: "오늘의 소감",
  createdAt: "2026-07-31T10:00:00+09:00",
  problem: {
    problemId: "42576",
    title: "완주하지 못한 선수",
    url: "https://school.programmers.co.kr/learn/courses/30/lessons/42576",
    language: "Java",
    startedAt: "2026-07-31T09:12:00+09:00",
    solvedAt: "2026-07-31T09:54:18+09:00",
    durationSeconds: 2538,
    durationEdited: false,
    source: "chrome-extension"
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("GitHub Contents 업로드", () => {
  it("사용자 파일이 없으면 첫 업로드에서 생성한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ login: "aryoo", name: "유아름", avatar_url: "avatar" }))
      .mockResolvedValueOnce(json({ message: "Not Found" }, 404))
      .mockResolvedValueOnce(json({ commit: { sha: "commit-1" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const result = await uploadPendingSolve(settings, pending);
    expect(result).toMatchObject({ status: "success", commitSha: "commit-1" });
    const put = fetchMock.mock.calls[2]!;
    expect(put[1]).toMatchObject({ method: "PUT" });
  });

  it("409 충돌 후 최신 파일을 재조회하고 병합한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ login: "aryoo", name: null, avatar_url: "avatar" }))
      .mockResolvedValueOnce(json({ message: "Not Found" }, 404))
      .mockResolvedValueOnce(json({ message: "Conflict" }, 409))
      .mockResolvedValueOnce(json({ message: "Not Found" }, 404))
      .mockResolvedValueOnce(json({ commit: { sha: "commit-2" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadPendingSolve(settings, pending)).resolves.toMatchObject({ commitSha: "commit-2" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("재시도 초과 시 오류를 내고 전달한 임시 기록은 변경하지 않는다", async () => {
    const original = structuredClone(pending);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ login: "aryoo", name: null, avatar_url: "avatar" }));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fetchMock.mockResolvedValueOnce(json({ message: "Not Found" }, 404));
      fetchMock.mockResolvedValueOnce(json({ message: "Conflict" }, 409));
    }
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadPendingSolve(settings, pending)).rejects.toBeInstanceOf(GitHubApiError);
    expect(pending).toEqual(original);
  });
});
