import type { ExtensionSettings, PendingSolve, TimerState } from "@coding-club/shared";

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

export function pendingStorageKey(githubId: string, problemId: string): string {
  return `pending:${githubId}:${problemId}`;
}

export async function findPending(): Promise<Array<{ key: string; value: PendingSolve }>> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith("pending:"))
    .map(([key, value]) => ({ key, value: value as PendingSolve }));
}

export async function findTimers(): Promise<Array<{ key: string; value: TimerState }>> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith("timer:"))
    .map(([key, value]) => ({ key, value: value as TimerState }));
}
