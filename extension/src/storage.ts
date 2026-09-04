import {
  timerStorageKey,
  type ExtensionSettings,
  type PendingSolve,
  type TimerState,
  type UploadResult
} from "@coding-club/shared";

export const SETTINGS_KEY = "codingClubSettings";
export const LAST_UPLOAD_KEY = "codingClubLastUpload";
export const PANEL_POSITION_KEY = "codingClubPanelPosition";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as ExtensionSettings | undefined) ?? { owner: "", repo: "", branch: "main" };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getStored<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function setStored<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function removeStored(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

export function pendingStorageKey(githubId: string, problemId: string, createdAt?: string): string {
  const legacyKey = `pending:${githubId}:${problemId}`;
  return createdAt ? `${legacyKey}:${createdAt}` : legacyKey;
}

export async function findPending(): Promise<Array<{ key: string; value: PendingSolve }>> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith("pending:"))
    .map(([key, value]) => ({ key, value: value as PendingSolve }))
    .sort((left, right) => left.value.createdAt.localeCompare(right.value.createdAt) || left.key.localeCompare(right.key));
}

export async function findPendingForProblem(
  githubId: string,
  problemId: string
): Promise<{ key: string; value: PendingSolve } | undefined> {
  const pending = await findPending();
  for (let index = pending.length - 1; index >= 0; index -= 1) {
    const candidate = pending[index]!;
    if (candidate.value.githubId === githubId && candidate.value.problem.problemId === problemId) return candidate;
  }
  return undefined;
}

export async function findTimers(): Promise<Array<{ key: string; value: TimerState }>> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith("timer:"))
    .map(([key, value]) => ({ key, value: value as TimerState }));
}

export async function completePendingUpload(
  pendingKey: string,
  pending: PendingSolve,
  status: UploadResult["status"],
  uploadedAt = new Date()
): Promise<void> {
  const legacyKey = pendingStorageKey(pending.githubId, pending.problem.problemId);
  if (pendingKey !== legacyKey && !pendingKey.startsWith(`${legacyKey}:`)) {
    throw new Error("업로드 대기 기록 키가 일치하지 않습니다.");
  }
  const timerKey = timerStorageKey(pending.githubId, pending.problem.problemId);
  const [storedPending, timer] = await Promise.all([
    getStored<PendingSolve>(pendingKey),
    getStored<TimerState>(timerKey)
  ]);
  const isUploadedSnapshot = JSON.stringify(storedPending) === JSON.stringify(pending);
  const completed: Record<string, unknown> = {
    [LAST_UPLOAD_KEY]: status === "duplicate" ? "이미 등록된 기록" : uploadedAt.toLocaleString("ko-KR")
  };
  if (timer && isUploadedSnapshot) completed[timerKey] = { ...timer, status: "uploaded" } satisfies TimerState;
  await chrome.storage.local.set(completed);
  if (!isUploadedSnapshot) return;
  const latestPending = await getStored<PendingSolve>(pendingKey);
  if (JSON.stringify(latestPending) === JSON.stringify(pending)) await removeStored(pendingKey);
}
