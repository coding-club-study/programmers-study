import {
  createTimer,
  elapsedTimerSeconds,
  formatDuration,
  isStaleTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  timerStorageKey,
  type PendingSolve,
  type ProblemRecord,
  type TimerState
} from "@coding-club/shared";
import { isAcceptedResult, parseProblemPage, type ProblemPageInfo } from "./programmers-parser";
import {
  getSettings,
  getStored,
  LAST_UPLOAD_KEY,
  PANEL_POSITION_KEY,
  pendingStorageKey,
  removeStored,
  setStored
} from "./storage";

const PANEL_ID = "coding-club-panel";
const galmuriFontUrl = chrome.runtime.getURL("fonts/Galmuri11.woff2");
const styles = `
  @font-face{font-family:Galmuri11;src:url("${galmuriFontUrl}") format("woff2");font-display:swap}
  :host{all:initial}
  *{box-sizing:border-box}
  .panel{width:310px;padding:14px;border:2px solid #241d29;border-radius:13px;background:#fffefd;color:#241d29;box-shadow:5px 5px 0 #241d29;font-family:Galmuri11,monospace;font-size:12px;line-height:1.55}
  button,input,textarea{font:inherit;color:inherit}
  button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #ff5b9d;outline-offset:2px}
  .top{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid #241d29;cursor:move;user-select:none}
  .top b{font-size:12px}.top button{border:0;background:transparent;cursor:pointer}
  .problem{margin:12px 0 3px;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta,.warning{color:#726875;font-size:11px}.warning{margin-top:7px;color:#9b3e62}
  .clock{margin:18px 0 12px;text-align:center;font-size:28px;font-weight:700;letter-spacing:.08em}
  .goal{display:flex;justify-content:space-between;padding:8px;border-radius:7px;background:#eee8ff;font-size:11px}.goal b{color:#6947c6}
  .actions{display:flex;gap:7px;margin-top:11px}.actions button{flex:1;padding:8px 5px;border:2px solid #241d29;border-radius:7px;background:#fff;box-shadow:2px 2px 0 #241d29;cursor:pointer}.actions .primary{background:#aa8bfa}.actions .hot{background:#ff5b9d;color:#fff}
  .solved{display:inline-block;margin-top:12px;padding:5px 9px;border:2px solid #241d29;border-radius:99px;background:#bdedcd;font-weight:700;transform:rotate(-2deg)}
  label{display:block;margin-top:10px;font-size:11px;font-weight:700}
  textarea,input{width:100%;margin-top:4px;padding:8px;border:2px solid #241d29;border-radius:7px;background:#fff}
  textarea{min-height:70px;resize:vertical}
  .status{margin-top:10px;padding:8px;border-left:4px solid #aa8bfa;background:#f5f1ff;font-size:11px}
  .error{border-left-color:#ff5b9d;background:#fff0f5}
  .stale{padding:8px;margin-top:10px;border:2px solid #241d29;border-radius:7px;background:#fff4d8}
  .hidden{display:none}
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]!);
}

function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

async function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function initialize() {
  if (document.getElementById(PANEL_ID)) return;
  const parsedPage = parseProblemPage();
  if (!parsedPage) return;
  const page: ProblemPageInfo = parsedPage;

  const host = document.createElement("div");
  host.id = PANEL_ID;
  host.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647";
  const savedPosition = await getStored<{ left: number; top: number }>(PANEL_POSITION_KEY);
  if (savedPosition) {
    host.style.left = `${savedPosition.left}px`;
    host.style.top = `${savedPosition.top}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
  }
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${styles}</style><section class="panel" aria-live="polite"></section>`;
  document.documentElement.appendChild(host);
  const panel = shadow.querySelector<HTMLElement>(".panel")!;
  const settings = await getSettings();

  const githubId = settings.githubId ?? "";
  if (!githubId) {
    panel.innerHTML = `
      <div class="top"><b>CODING CLUB!</b><button data-close>×</button></div>
      <p class="problem">${escapeHtml(page.title)}</p>
      <p class="status error">확장 프로그램 팝업에서 GitHub 저장소를 먼저 연결해 주세요.</p>
    `;
    panel.querySelector("[data-close]")?.addEventListener("click", () => host.remove());
    return;
  }

  const timerInput = {
    githubId,
    problemId: page.problemId,
    title: page.title,
    url: page.url,
    language: page.language
  };
  const timerKey = timerStorageKey(githubId, page.problemId);
  const pendingKey = pendingStorageKey(githubId, page.problemId);
  let timer: TimerState = (await getStored<TimerState>(timerKey)) ?? createTimer(timerInput);
  let pending = await getStored<PendingSolve>(pendingKey);
  await setStored(timerKey, timer);
  let collapsed = false;
  let statusMessage = "";
  let statusError = false;
  let staleAccepted = false;
  let tickHandle = 0;
  let solvedHandled = timer.status === "solved" || timer.status === "uploaded";

  function goalText() {
    if (!timer?.goalMinutes) return "목표 시간 없음";
    const remaining = timer.goalMinutes * 60 - elapsedTimerSeconds(timer);
    return remaining > 0 ? `${formatClock(remaining)} 남음` : `${formatDuration(Math.abs(remaining))} 초과`;
  }

  function maybeNotifyGoal() {
    if (!timer?.goalMinutes || timer.goalNotified || timer.status !== "running") return;
    if (elapsedTimerSeconds(timer) < timer.goalMinutes * 60) return;
    timer = { ...timer, goalNotified: true };
    void setStored(timerKey, timer);
    statusMessage = "목표 시간이 지났어요! 스톱워치는 계속 기록 중입니다.";
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.connect(context.destination);
      oscillator.frequency.value = 740;
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    } catch {
      // 소리를 재생할 수 없어도 화면 알림은 유지한다.
    }
  }

  function render() {
    if (!timer) return;
    const elapsed = elapsedTimerSeconds(timer);
    panel.innerHTML = `
      <div class="top"><b>${pending ? "SOLVED! ★" : "CODING TIME"}</b><button data-collapse>${collapsed ? "펼치기 ＋" : "접기 －"}</button></div>
      <div class="${collapsed ? "hidden" : ""}">
        <p class="problem">${escapeHtml(page.title)}</p>
        <div class="meta">${escapeHtml(page.language)} · 시작 ${new Date(timer.startedAt).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</div>
        ${page.warnings.map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`).join("")}
        ${pending ? solvedMarkup(pending) : runningMarkup(elapsed)}
        ${statusMessage ? `<div class="status ${statusError ? "error" : ""}">${escapeHtml(statusMessage)}</div>` : ""}
      </div>
    `;
    bindActions();
  }

  function runningMarkup(elapsed: number) {
    const stale = isStaleTimer(timer!) && !staleAccepted;
    return `
      <div class="clock">${formatClock(elapsed)}</div>
      <div class="goal"><span>${timer!.goalMinutes ? `목표 ${timer!.goalMinutes}분` : "목표 시간 선택"}</span><b>${goalText()}</b></div>
      ${stale ? `<div class="stale">이 타이머는 12시간 이상 전에 시작됐어요.<div class="actions"><button data-keep>계속 사용</button><button data-reset>지금부터</button></div></div>` : ""}
      <div class="actions">
        <button data-pause>${timer!.status === "paused" ? "재개" : "일시정지"}</button>
        <button data-reset>처음부터</button>
        <button class="primary" data-goal>목표 설정</button>
      </div>
      <div class="actions"><button data-manual>현재 기록 정답 처리</button></div>
    `;
  }

  function solvedMarkup(value: PendingSolve) {
    return `
      <span class="solved">SOLVED! ★</span>
      <div class="clock">${formatClock(value.problem.durationSeconds)}</div>
      <label>풀이 시간
        <input data-duration inputmode="numeric" value="${formatClock(value.problem.durationSeconds)}" aria-label="풀이 시간">
      </label>
      <label>오늘의 소감
        <textarea data-reflection maxlength="500" placeholder="선택 사항이에요">${escapeHtml(value.reflection)}</textarea>
      </label>
      <div class="actions">
        <button data-cancel>기록 취소</button>
        <button class="hot" data-upload>풀이 기록 업로드</button>
      </div>
    `;
  }

  function bindActions() {
    panel.querySelector("[data-collapse]")?.addEventListener("click", () => { collapsed = !collapsed; render(); });
    panel.querySelector("[data-pause]")?.addEventListener("click", async () => {
      timer = timer.status === "paused" ? resumeTimer(timer) : pauseTimer(timer);
      await setStored(timerKey, timer);
      render();
    });
    panel.querySelectorAll("[data-reset]").forEach((button) => button.addEventListener("click", async () => {
      timer = createTimer(timerInput);
      await setStored(timerKey, timer);
      statusMessage = "지금부터 새로 기록합니다.";
      render();
    }));
    panel.querySelector("[data-keep]")?.addEventListener("click", () => {
      staleAccepted = true;
      statusMessage = "기존 시작 시각을 유지합니다.";
      statusError = false;
      render();
    });
    panel.querySelector("[data-goal]")?.addEventListener("click", async () => {
      const input = prompt("목표 시간을 분 단위로 입력해 주세요. 비워두면 해제됩니다.", timer.goalMinutes?.toString() ?? "");
      if (input === null) return;
      const minutes = input.trim() ? Number(input) : undefined;
      if (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0 || minutes > 720)) {
        statusMessage = "목표 시간은 1~720분 사이로 입력해 주세요.";
        statusError = true;
      } else {
        timer = { ...timer, goalMinutes: minutes, goalNotified: false };
        await setStored(timerKey, timer);
        statusMessage = minutes ? `목표 시간을 ${minutes}분으로 설정했어요.` : "목표 시간을 해제했어요.";
        statusError = false;
      }
      render();
    });
    panel.querySelector("[data-manual]")?.addEventListener("click", () => {
      if (confirm("정답 제출을 직접 확인했나요? 이 기록을 업로드 준비 상태로 전환할까요?")) void prepareSolved();
    });
    panel.querySelector("[data-duration]")?.addEventListener("change", async (event) => {
      if (!pending) return;
      const value = (event.currentTarget as HTMLInputElement).value.trim();
      const parts = value.split(":").map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
        statusMessage = "풀이 시간은 00:42:18 형식으로 입력해 주세요.";
        statusError = true;
        render();
        return;
      }
      const seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
      const original = pending.problem.originalDurationSeconds ?? pending.problem.durationSeconds;
      pending = {
        ...pending,
        problem: {
          ...pending.problem,
          durationSeconds: seconds,
          durationEdited: seconds !== original,
          originalDurationSeconds: seconds !== original ? original : undefined
        }
      };
      await setStored(pendingKey, pending);
      render();
    });
    panel.querySelector("[data-reflection]")?.addEventListener("input", async (event) => {
      if (!pending) return;
      pending = { ...pending, reflection: (event.currentTarget as HTMLTextAreaElement).value };
      await setStored(pendingKey, pending);
    });
    panel.querySelector("[data-upload]")?.addEventListener("click", async () => {
      if (!pending) return;
      statusMessage = "GitHub에 기록을 업로드하는 중 · · ·";
      statusError = false;
      render();
      const response = await sendMessage<{ ok: boolean; result?: { status: string }; error?: string }>({ type: "record.upload", pending });
      if (!response.ok) {
        statusMessage = response.error ?? "업로드에 실패했습니다.";
        statusError = true;
        render();
        return;
      }
      statusMessage = response.result?.status === "duplicate" ? "이미 오늘 업로드된 문제예요." : "업로드 완료! 대시보드가 곧 새로 배포됩니다.";
      statusError = false;
      timer = { ...timer, status: "uploaded" };
      await setStored(timerKey, timer);
      await removeStored(pendingKey);
      await setStored(LAST_UPLOAD_KEY, response.result?.status === "duplicate" ? "이미 등록된 기록" : new Date().toLocaleString("ko-KR"));
      pending = undefined;
      render();
    });
    panel.querySelector("[data-cancel]")?.addEventListener("click", async () => {
      if (!confirm("업로드 대기 기록을 취소할까요? 타이머는 처음부터 다시 시작됩니다.")) return;
      await removeStored(pendingKey);
      pending = undefined;
      solvedHandled = false;
      timer = createTimer(timerInput);
      await setStored(timerKey, timer);
      render();
    });
  }

  async function prepareSolved() {
    if (solvedHandled && pending) return;
    solvedHandled = true;
    timer = stopTimer(timer);
    const durationSeconds = elapsedTimerSeconds(timer);
    const problem: ProblemRecord = {
      problemId: page.problemId,
      title: page.title,
      url: page.url,
      language: page.language,
      startedAt: timer.startedAt,
      solvedAt: timer.solvedAt!,
      durationSeconds,
      durationEdited: false,
      source: "chrome-extension"
    };
    pending = { githubId, problem, reflection: "", createdAt: new Date().toISOString() };
    await Promise.all([setStored(timerKey, timer), setStored(pendingKey, pending)]);
    statusMessage = "정답을 확인했어요. 내용을 확인한 뒤 업로드해 주세요.";
    statusError = false;
    render();
  }

  function makeDraggable() {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    panel.addEventListener("pointerdown", (event) => {
      if (!(event.target as HTMLElement).closest(".top") || (event.target as HTMLElement).closest("button")) return;
      const rect = host.getBoundingClientRect();
      dragging = true;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.setPointerCapture(event.pointerId);
    });
    panel.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const left = Math.max(8, Math.min(window.innerWidth - host.offsetWidth - 8, event.clientX - offsetX));
      const top = Math.max(8, Math.min(window.innerHeight - host.offsetHeight - 8, event.clientY - offsetY));
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    });
    panel.addEventListener("pointerup", async () => {
      dragging = false;
      const rect = host.getBoundingClientRect();
      await setStored(PANEL_POSITION_KEY, { left: rect.left, top: rect.top });
    });
  }

  render();
  makeDraggable();
  tickHandle = window.setInterval(() => {
    maybeNotifyGoal();
    if (!pending && !collapsed) render();
  }, 1000);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[timerKey]?.newValue) {
      timer = changes[timerKey].newValue as TimerState;
      render();
    }
    if (changes[pendingKey]) {
      pending = changes[pendingKey].newValue as PendingSolve | undefined;
      render();
    }
  });

  let observerQueued = false;
  const observer = new MutationObserver(() => {
    if (observerQueued || solvedHandled) return;
    observerQueued = true;
    window.setTimeout(() => {
      observerQueued = false;
      if (isAcceptedResult()) void prepareSolved();
    }, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  window.addEventListener("pagehide", () => {
    clearInterval(tickHandle);
    observer.disconnect();
  }, { once: true });
}

void initialize();
