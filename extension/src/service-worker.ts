import { uploadPendingSolve, verifyConnection } from "./github";
import { completePendingUpload, getSettings, saveSettings } from "./storage";
import type { ExtensionSettings, PendingSolve } from "@coding-club/shared";

type Message =
  | { type: "github.verify"; settings: ExtensionSettings }
  | { type: "record.upload"; pendingKey: string; pending: PendingSolve };

let uploadQueue: Promise<void> = Promise.resolve();
const activeUploads = new Map<string, ReturnType<typeof uploadPendingSolve>>();

function queueUpload(pendingKey: string, pending: PendingSolve) {
  const active = activeUploads.get(pendingKey);
  if (active) return active;

  const upload = uploadQueue.then(async () => {
    const settings = await getSettings();
    const result = await uploadPendingSolve(settings, pending);
    await completePendingUpload(pendingKey, pending, result.status);
    return result;
  });
  activeUploads.set(pendingKey, upload);
  uploadQueue = upload.then(() => undefined, () => undefined);
  void upload.then(
    () => activeUploads.delete(pendingKey),
    () => activeUploads.delete(pendingKey)
  );
  return upload;
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === "github.verify") {
        const result = await verifyConnection(message.settings);
        if (!result.canPush) throw new Error("저장소 Contents 쓰기 권한이 없습니다.");
        const next: ExtensionSettings = {
          ...message.settings,
          githubId: result.profile.login,
          displayName: result.profile.name ?? result.profile.login,
          profileImageUrl: result.profile.avatar_url
        };
        await saveSettings(next);
        sendResponse({ ok: true, settings: next });
        return;
      }
      if (message.type === "record.upload") {
        const result = await queueUpload(message.pendingKey, message.pending);
        sendResponse({ ok: true, result });
        return;
      }
      sendResponse({ ok: false, error: "지원하지 않는 요청입니다." });
    } catch (cause) {
      sendResponse({ ok: false, error: cause instanceof Error ? cause.message : "알 수 없는 오류가 발생했습니다." });
    }
  })();
  return true;
});
