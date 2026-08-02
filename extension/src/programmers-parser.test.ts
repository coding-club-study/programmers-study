// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { extractLanguage, extractProblemId, isAcceptedResult, parseProblemPage } from "./programmers-parser";

describe("프로그래머스 페이지 파서", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/learn/courses/30/lessons/42576");
  });

  it("문제 URL에서 ID를 추출한다", () => {
    expect(extractProblemId("https://school.programmers.co.kr/learn/courses/30/lessons/42576")).toBe("42576");
  });

  it("URL 파라미터의 언어 코드를 표시 이름으로 변환한다", () => {
    expect(extractLanguage("https://school.programmers.co.kr/learn/courses/30/lessons/181952?language=csharp")).toBe("C#");
    expect(extractLanguage("https://school.programmers.co.kr/learn/courses/30/lessons/181952?language=java")).toBe("Java");
  });

  it("DOM보다 URL의 선택 언어를 우선한다", () => {
    window.history.replaceState({}, "", "/learn/courses/30/lessons/181952?language=csharp");
    document.body.innerHTML = `<main><h1>문자열 출력하기</h1><button class="language-select">Java</button></main>`;
    expect(parseProblemPage()).toMatchObject({ language: "C#", warnings: [] });
  });

  it("제목과 언어를 추출하고 실패 항목은 경고한다", () => {
    document.body.innerHTML = `<main><h1>완주하지 못한 선수</h1><select name="language"><option selected>Java</option></select></main>`;
    expect(parseProblemPage()).toMatchObject({
      problemId: "42576",
      title: "완주하지 못한 선수",
      language: "Java",
      warnings: []
    });
  });

  it("일반 본문에 정답 문자열이 있어도 성공으로 처리하지 않는다", () => {
    document.body.innerHTML = `<main>정답을 제출해 보세요.</main>`;
    expect(isAcceptedResult()).toBe(false);
  });

  it("결과 컨테이너의 명시적 성공 상태만 감지한다", () => {
    document.body.innerHTML = `<div role="dialog"><div class="submission-success">채점 결과 정답입니다.</div></div>`;
    expect(isAcceptedResult()).toBe(true);
  });

  it("표시된 완료 모달의 정답 문구를 감지한다", () => {
    document.body.innerHTML = `<div id="modal-dialog" class="modal fade show" role="dialog" aria-modal="true" style="display: block"><strong>정답입니다!</strong><button>다른 문제 풀기</button></div>`;
    expect(isAcceptedResult()).toBe(true);
  });

  it("숨겨진 완료 모달은 감지하지 않는다", () => {
    document.body.innerHTML = `<div id="modal-dialog" class="modal fade" role="dialog" aria-hidden="true"><strong>정답입니다!</strong></div>`;
    expect(isAcceptedResult()).toBe(false);
  });

  it("show 클래스가 없는 프로그래머스 모달은 aria-hidden이 없어도 감지하지 않는다", () => {
    document.body.innerHTML = `<div id="modal-dialog" class="modal fade" role="dialog"><strong>정답입니다!</strong></div>`;
    expect(isAcceptedResult()).toBe(false);
  });

  it("오답과 컴파일 오류는 성공으로 처리하지 않는다", () => {
    document.body.innerHTML = `<div role="dialog"><div class="result-error">컴파일 오류</div></div>`;
    expect(isAcceptedResult()).toBe(false);
  });
});
