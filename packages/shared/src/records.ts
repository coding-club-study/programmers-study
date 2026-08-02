import { REFLECTION_MAX_LENGTH, type GitHubProfile, type ProblemRecord, type UserData } from "./types";
import { toSeoulDateKey } from "./date";

export class DuplicateProblemError extends Error {
  constructor() {
    super("이미 오늘 업로드된 문제예요.");
    this.name = "DuplicateProblemError";
  }
}

export function createUserData(profile: GitHubProfile, joinedAt = new Date()): UserData {
  return {
    githubId: profile.login,
    displayName: profile.name?.trim() || profile.login,
    profileImageUrl: profile.avatar_url,
    joinedAt: toSeoulDateKey(joinedAt),
    days: {}
  };
}

export function validateReflection(reflection: string): string {
  const normalized = reflection.replace(/\r\n/g, "\n").trim();
  if (normalized.length > REFLECTION_MAX_LENGTH) {
    throw new Error(`문제별 소감은 ${REFLECTION_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }
  return normalized;
}

export function hasDuplicate(user: UserData, problem: ProblemRecord): boolean {
  const dateKey = toSeoulDateKey(problem.solvedAt);
  return Boolean(user.days[dateKey]?.problems.some((item) => item.problemId === problem.problemId));
}

export function mergeProblem(
  original: UserData,
  problem: ProblemRecord,
  reflection?: string
): UserData {
  if (hasDuplicate(original, problem)) throw new DuplicateProblemError();
  const dateKey = toSeoulDateKey(problem.solvedAt);
  const existing = original.days[dateKey];
  const problemWithReflection: ProblemRecord = {
    ...problem,
    ...(reflection?.trim() ? { reflection: validateReflection(reflection) } : {})
  };
  return {
    ...original,
    days: {
      ...original.days,
      [dateKey]: {
        reflection: existing?.reflection ?? "",
        problems: [...(existing?.problems ?? []), problemWithReflection]
      }
    }
  };
}

export function assertUserOwnsFile(authenticatedId: string, fileGithubId: string): void {
  if (authenticatedId !== fileGithubId) {
    throw new Error("인증된 GitHub 사용자와 수정하려는 데이터 파일이 일치하지 않습니다.");
  }
}
