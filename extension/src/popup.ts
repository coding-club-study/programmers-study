import "./popup.css";
import type { ExtensionSettings } from "@coding-club/shared";
import {
  findPending,
  findTimers,
  getSettings,
  LAST_UPLOAD_KEY,
  saveSettings
} from "./storage";

const status = document.querySelector<HTMLElement>("#status")!;
const form = document.querySelector<HTMLFormElement>("#settings")!;
const token = document.querySelector<HTMLInputElement>("#token")!;
const owner = document.querySelector<HTMLInputElement>("#owner")!;
const repo = document.querySelector<HTMLInputElement>("#repo")!;
const branch = document.querySelector<HTMLInputElement>("#branch")!;
const dashboardUrl = document.querySelector<HTMLInputElement>("#dashboardUrl")!;
const activity = document.querySelector<HTMLElement>("#activity")!;
const message = document.querySelector<HTMLElement>("#message")!;
const openDashboard = document.querySelector<HTMLButtonElement>("#openDashboard")!;
const uploadPending = document.querySelector<HTMLButtonElement>("#uploadPending")!;

let settings = await getSettings();

function showMessage(text: string, error = false) {
  message.textContent = text;
  message.className = error ? "error" : "";
}

async function refresh() {
  settings = await getSettings();
  owner.value = settings.owner;
  repo.value = settings.repo;
  branch.value = settings.branch || "main";
  dashboardUrl.value = settings.dashboardUrl ?? "";
  openDashboard.disabled = !settings.githubId || !settings.dashboardUrl;
  openDashboard.title = !settings.githubId
    ? "GitHub을 연결하면 사용할 수 있습니다."
    : !settings.dashboardUrl
      ? "대시보드 URL을 설정해 주세요."
      : "대시보드 열기";
  status.innerHTML = settings.githubId
    ? `<img src="${settings.profileImageUrl ?? ""}" alt=""><div><b>@${settings.githubId} 연결됨</b><span>Contents 쓰기 권한 확인</span></div>`
    : `<div><b>GitHub 연결 필요</b><span>Organization 멤버는 fine-grained PAT를 권장합니다.</span></div>`;
  status.className = `status ${settings.githubId ? "connected" : ""}`;

  const [timers, pending, lastUpload] = await Promise.all([
    findTimers(),
    findPending(),
    chrome.storage.local.get(LAST_UPLOAD_KEY)
  ]);
  const running = timers.find(({ value }) => value.status === "running" || value.status === "paused")?.value;
  uploadPending.disabled = pending.length === 0;
  uploadPending.textContent = pending.length > 0 ? `${pending.length}건 모두 업로드` : "대기 기록 업로드";
  activity.innerHTML = `
    <div><span>RUNNING</span>${running ? `${running.title}<b>${running.status === "paused" ? "일시정지" : "기록 중"}</b>` : "실행 중인 타이머 없음"}</div>
    <div><span>WAITING</span>업로드 대기 ${pending.length}건</div>
    <div><span>LAST UPLOAD</span>${String(lastUpload[LAST_UPLOAD_KEY] ?? "아직 업로드 기록 없음")}</div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const next: ExtensionSettings = {
    ...settings,
    owner: owner.value.trim(),
    repo: repo.value.trim(),
    branch: branch.value.trim() || "main",
    dashboardUrl: dashboardUrl.value.trim() || undefined,
    githubToken: token.value.trim() || settings.githubToken
  };
  if (!next.githubToken) {
    showMessage("GitHub access token을 입력해 주세요.", true);
    return;
  }
  showMessage("GitHub 사용자와 저장소 권한을 확인하는 중 · · ·");
  const response = await chrome.runtime.sendMessage({ type: "github.verify", settings: next }) as {
    ok: boolean;
    settings?: ExtensionSettings;
    error?: string;
  };
  if (!response.ok || !response.settings) {
    showMessage(response.error ?? "연결 확인에 실패했습니다.", true);
    return;
  }
  await saveSettings(response.settings);
  token.value = "";
  showMessage("GitHub 연결과 쓰기 권한을 확인했습니다.");
  await refresh();
});

document.querySelector("#disconnect")?.addEventListener("click", async () => {
  settings = { owner: settings.owner, repo: settings.repo, branch: settings.branch, dashboardUrl: settings.dashboardUrl };
  await saveSettings(settings);
  token.value = "";
  showMessage("이 브라우저에서 GitHub 연결 정보를 삭제했습니다.");
  await refresh();
});

document.querySelector("#openTimer")?.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ url: "https://school.programmers.co.kr/learn/courses/*/lessons/*" });
  const target = tabs[0];
  if (!target?.id) {
    showMessage("열려 있는 프로그래머스 문제 탭이 없습니다.", true);
    return;
  }
  await chrome.tabs.update(target.id, { active: true });
  if (target.windowId) await chrome.windows.update(target.windowId, { focused: true });
  window.close();
});

uploadPending.addEventListener("click", async () => {
  const pending = await findPending();
  if (pending.length === 0) {
    showMessage("업로드 대기 중인 기록이 없습니다.");
    return;
  }

  uploadPending.disabled = true;
  let uploaded = 0;
  let duplicates = 0;
  try {
    for (const [index, item] of pending.entries()) {
      showMessage(`대기 기록 업로드 중 ${index + 1}/${pending.length} · · ·`);
      const response = await chrome.runtime.sendMessage({ type: "record.upload", pendingKey: item.key, pending: item.value }) as {
        ok: boolean;
        result?: { status: string };
        error?: string;
      };
      if (!response.ok) {
        showMessage(`${uploaded + duplicates}건 처리 후 중단했습니다. ${response.error ?? "업로드에 실패했습니다."}`, true);
        return;
      }
      if (response.result?.status === "duplicate") duplicates += 1;
      else uploaded += 1;
    }

    const duplicateText = duplicates > 0 ? ` · 이미 등록 ${duplicates}건 정리` : "";
    showMessage(`새 기록 ${uploaded}건 업로드 완료${duplicateText}`);
  } catch {
    showMessage(`${uploaded + duplicates}건 처리 후 중단했습니다. 확장 프로그램 연결을 다시 확인해 주세요.`, true);
  } finally {
    await refresh();
  }
});

openDashboard.addEventListener("click", async () => {
  if (!settings.dashboardUrl) {
    showMessage("대시보드 URL을 먼저 설정해 주세요.", true);
    return;
  }
  await chrome.tabs.create({ url: settings.dashboardUrl });
});

await refresh();
