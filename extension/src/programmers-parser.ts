export interface ProblemPageInfo {
  problemId: string;
  title: string;
  url: string;
  language: string;
  warnings: string[];
}

const TITLE_SELECTORS = [
  "main h1",
  "[data-testid='challenge-title']",
  ".challenge-title",
  ".lesson-title",
  "h2"
];

const LANGUAGE_SELECTORS = [
  "select[name*='language'] option:checked",
  "[data-testid='language-selector'] [aria-selected='true']",
  ".language-select option:checked",
  "button[class*='language']"
];

const RESULT_CONTAINERS = [
  "[data-testid='submission-result']",
  "[class*='result'] [class*='modal']",
  ".modal-dialog",
  "[role='dialog']"
];

export function extractProblemId(url = location.href): string | null {
  return new URL(url).pathname.match(/\/lessons\/(\d+)/)?.[1] ?? null;
}

function firstText(selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

export function parseProblemPage(): ProblemPageInfo | null {
  const problemId = extractProblemId();
  if (!problemId) return null;
  const warnings: string[] = [];
  const title = firstText(TITLE_SELECTORS) ?? `문제 ${problemId}`;
  const language = firstText(LANGUAGE_SELECTORS) ?? "언어 확인 필요";
  if (title === `문제 ${problemId}`) warnings.push("문제 제목을 가져오지 못했습니다.");
  if (language === "언어 확인 필요") warnings.push("선택 언어를 가져오지 못했습니다.");
  return { problemId, title, language, url: location.href, warnings };
}

export function isAcceptedResult(): boolean {
  for (const selector of RESULT_CONTAINERS) {
    const container = document.querySelector(selector);
    if (!container) continue;
    const text = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const explicitSuccess =
      container.querySelector("[class*='success'], [data-status='accepted'], [aria-label*='정답']") !== null;
    if (
      explicitSuccess &&
      (/정답입니다|채점 결과.*정답|통과|accepted/i.test(text) || /100(?:\.0+)?\s*점/.test(text))
    ) {
      return true;
    }
  }
  return false;
}
