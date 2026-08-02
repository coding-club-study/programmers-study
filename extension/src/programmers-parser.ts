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
  ".challenge-content[data-language]",
  ".dropdown-language > button",
  "select[name*='language'] option:checked",
  "[data-testid='language-selector'] [aria-selected='true']",
  ".language-select option:checked",
  "button[class*='language']"
];

const LANGUAGE_NAMES: Record<string, string> = {
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  python: "Python",
  python3: "Python3",
  ruby: "Ruby",
  scala: "Scala",
  swift: "Swift"
};

const RESULT_CONTAINERS = [
  "#modal-dialog.show",
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
    const element = document.querySelector(selector);
    const text = element?.getAttribute("data-language")?.trim() || element?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

export function extractLanguage(url = location.href): string | null {
  const value = new URL(url).searchParams.get("language")?.trim().toLowerCase();
  return value ? (LANGUAGE_NAMES[value] ?? value) : null;
}

export function parseProblemPage(): ProblemPageInfo | null {
  const problemId = extractProblemId();
  if (!problemId) return null;
  const warnings: string[] = [];
  const title = firstText(TITLE_SELECTORS) ?? `문제 ${problemId}`;
  const language = extractLanguage() ?? firstText(LANGUAGE_SELECTORS) ?? "언어 확인 필요";
  if (title === `문제 ${problemId}`) warnings.push("문제 제목을 가져오지 못했습니다.");
  if (language === "언어 확인 필요") warnings.push("선택 언어를 가져오지 못했습니다.");
  return { problemId, title, language, url: location.href, warnings };
}

export function isAcceptedResult(): boolean {
  for (const selector of RESULT_CONTAINERS) {
    const container = document.querySelector(selector);
    if (!container) continue;
    if (container.id === "modal-dialog" && !container.classList.contains("show")) continue;
    const text = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const visible = !container.hasAttribute("hidden") && container.getAttribute("aria-hidden") !== "true";
    const rejected = /틀렸습니다|오답|컴파일 오류|실행 시간 초과|런타임 오류|실패/i.test(text);
    const accepted = /정답입니다|채점 결과.*정답|테스트를 통과|accepted/i.test(text) || /100(?:\.0+)?\s*점/.test(text);
    if (visible && accepted && !rejected) {
      return true;
    }
  }
  return false;
}
