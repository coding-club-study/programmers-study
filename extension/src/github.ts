import {
  DuplicateProblemError,
  assertUserOwnsFile,
  createUserData,
  hasDuplicate,
  mergeProblem,
  toSeoulDateKey,
  type ExtensionSettings,
  type GitHubProfile,
  type PendingSolve,
  type UploadResult,
  type UserData
} from "@coding-club/shared";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_CONFLICT_RETRIES = 3;

export class GitHubApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION
  };
}

async function responseError(response: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    detail = "";
  }
  const messages: Record<number, string> = {
    401: "GitHub 인증이 만료되었거나 토큰이 올바르지 않습니다.",
    403: "저장소 쓰기 권한이 없거나 main 직접 커밋이 제한되어 있습니다.",
    404: "저장소를 찾지 못했거나 접근 권한이 없습니다.",
    409: "GitHub 데이터 충돌이 발생했습니다.",
    422: "GitHub에 보낼 데이터 형식이 올바르지 않습니다."
  };
  throw new GitHubApiError(messages[response.status] ?? (detail || `GitHub API 오류 (${response.status})`), response.status);
}

async function request<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { ...headers(token), ...init?.headers } });
  } catch {
    throw new GitHubApiError("GitHub에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.", 0);
  }
  if (!response.ok) await responseError(response);
  return response.json() as Promise<T>;
}

export async function verifyConnection(settings: ExtensionSettings): Promise<{
  profile: GitHubProfile;
  canPush: boolean;
}> {
  if (!settings.githubToken) throw new Error("GitHub 토큰을 입력해 주세요.");
  const profile = await request<GitHubProfile>(`${API}/user`, settings.githubToken);
  const repository = await request<{ permissions?: { push?: boolean } }>(
    `${API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`,
    settings.githubToken
  );
  return { profile, canPush: repository.permissions?.push === true };
}

function decodeBase64(content: string): string {
  const bytes = Uint8Array.from(atob(content.replace(/\n/g, "")), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

interface ContentResponse {
  content: string;
  sha: string;
}

async function readUserFile(
  settings: Required<Pick<ExtensionSettings, "githubToken" | "owner" | "repo" | "branch">>,
  githubId: string
): Promise<{ data: UserData | null; sha?: string }> {
  const filePath = `data/users/${githubId}.json`;
  const url = `${API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${filePath}?ref=${encodeURIComponent(settings.branch)}`;
  const response = await fetch(url, { headers: headers(settings.githubToken) });
  if (response.status === 404) return { data: null };
  if (!response.ok) await responseError(response);
  const body = (await response.json()) as ContentResponse;
  try {
    return { data: JSON.parse(decodeBase64(body.content)) as UserData, sha: body.sha };
  } catch {
    throw new GitHubApiError("저장소의 사용자 JSON 형식이 올바르지 않습니다.", 422);
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function uploadPendingSolve(settings: ExtensionSettings, pending: PendingSolve): Promise<UploadResult> {
  if (!settings.githubToken) throw new Error("GitHub 연결이 필요합니다.");
  if (!settings.owner || !settings.repo) throw new Error("대상 저장소를 설정해 주세요.");
  const branch = settings.branch || "main";
  const auth = { githubToken: settings.githubToken, owner: settings.owner, repo: settings.repo, branch };
  const profile = await request<GitHubProfile>(`${API}/user`, settings.githubToken);
  assertUserOwnsFile(profile.login, pending.githubId);

  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
    const current = await readUserFile(auth, profile.login);
    const base = current.data ?? createUserData(profile);
    if (hasDuplicate(base, pending.problem)) return { status: "duplicate", data: base };

    let merged: UserData;
    try {
      merged = mergeProblem(base, pending.problem, pending.reflection, {
        updateReflection: Boolean(pending.reflection)
      });
    } catch (cause) {
      if (cause instanceof DuplicateProblemError) return { status: "duplicate", data: base };
      throw cause;
    }

    const dateKey = toSeoulDateKey(pending.problem.solvedAt);
    const body = {
      message: `solve: ${profile.login} added ${pending.problem.problemId} for ${dateKey}`,
      content: encodeBase64(`${JSON.stringify(merged, null, 2)}\n`),
      branch,
      ...(current.sha ? { sha: current.sha } : {})
    };
    const filePath = `data/users/${profile.login}.json`;
    const response = await fetch(
      `${API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${filePath}`,
      {
        method: "PUT",
        headers: { ...headers(settings.githubToken), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    if (response.status === 409) {
      if (attempt === MAX_CONFLICT_RETRIES - 1) {
        throw new GitHubApiError("동시 수정 충돌이 반복되었습니다. 임시 기록을 유지했으니 다시 시도해 주세요.", 409);
      }
      await delay(200 * 2 ** attempt);
      continue;
    }
    if (!response.ok) await responseError(response);
    const result = (await response.json()) as { commit: { sha: string } };
    return { status: "success", commitSha: result.commit.sha, data: merged };
  }
  throw new GitHubApiError("업로드 재시도 횟수를 초과했습니다.", 409);
}
