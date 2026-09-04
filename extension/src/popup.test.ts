// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSolve } from "@coding-club/shared";

const mocks = vi.hoisted(() => ({
  findPending: vi.fn(),
  findTimers: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("./storage", () => ({
  findPending: mocks.findPending,
  findTimers: mocks.findTimers,
  getSettings: mocks.getSettings,
  LAST_UPLOAD_KEY: "codingClubLastUpload",
  saveSettings: mocks.saveSettings
}));

function makePending(problemId: string, createdAt: string): { key: string; value: PendingSolve } {
  return {
    key: `pending:aryoo:${problemId}`,
    value: {
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
    }
  };
}

function setupDocument() {
  document.body.innerHTML = `
    <main>
      <section id="status"></section>
      <form id="settings">
        <input id="token"><input id="owner"><input id="repo"><input id="branch"><input id="dashboardUrl">
      </form>
      <section id="activity"></section>
      <button id="openDashboard"></button>
      <button id="openTimer"></button>
      <button id="uploadPending"></button>
      <button id="disconnect"></button>
      <p id="message"></p>
    </main>
  `;
}

describe("popup 대기 기록 전체 업로드", () => {
  const pending = [
    makePending("1", "2026-09-04T06:00:00.000Z"),
    makePending("2", "2026-09-04T06:01:00.000Z"),
    makePending("3", "2026-09-04T06:02:00.000Z")
  ];
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupDocument();
    mocks.getSettings.mockResolvedValue({
      githubId: "aryoo",
      owner: "coding-club-study",
      repo: "programmers-study",
      branch: "main"
    });
    mocks.findTimers.mockResolvedValue([]);
    mocks.saveSettings.mockResolvedValue(undefined);
    sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } },
      tabs: { query: vi.fn(), update: vi.fn(), create: vi.fn() },
      windows: { update: vi.fn() }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("오래된 순서의 모든 pending을 처리하고 결과를 요약한다", async () => {
    mocks.findPending.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValueOnce([]);
    sendMessage
      .mockResolvedValueOnce({ ok: true, result: { status: "success" } })
      .mockResolvedValueOnce({ ok: true, result: { status: "duplicate" } })
      .mockResolvedValueOnce({ ok: true, result: { status: "success" } });
    await import("./popup");

    expect(document.querySelector("#uploadPending")?.textContent).toBe("3건 모두 업로드");

    document.querySelector<HTMLButtonElement>("#uploadPending")!.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(document.querySelector("#message")?.textContent).toContain("새 기록 2건 업로드 완료"));

    expect(sendMessage.mock.calls.map(([message]) => message.pending.problem.problemId)).toEqual(["1", "2", "3"]);
    expect(sendMessage.mock.calls.map(([message]) => message.pendingKey)).toEqual(pending.map(({ key }) => key));
    expect(document.querySelector("#message")?.textContent).toContain("이미 등록 1건 정리");
  });

  it("중간 실패 시 이후 기록을 보내지 않고 처리된 건수를 알린다", async () => {
    mocks.findPending.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValueOnce(pending.slice(1));
    sendMessage
      .mockResolvedValueOnce({ ok: true, result: { status: "success" } })
      .mockResolvedValueOnce({ ok: false, error: "동시 수정 충돌" });
    await import("./popup");

    document.querySelector<HTMLButtonElement>("#uploadPending")!.click();
    await vi.waitFor(() => expect(document.querySelector("#message")?.textContent).toContain("1건 처리 후 중단했습니다"));

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(document.querySelector("#message")?.className).toBe("error");
  });
});
