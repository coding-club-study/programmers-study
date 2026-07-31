// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { extractProblemId, isAcceptedResult, parseProblemPage } from "./programmers-parser";

describe("프로그래머스 페이지 파서", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/learn/courses/30/lessons/42576");
  });

  it("문제 URL에서 ID를 추출한다", () => {
    expect(extractProblemId("https://school.programmers.co.kr/learn/courses/30/lessons/42576")).toBe("42576");
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

  it("오답과 컴파일 오류는 성공으로 처리하지 않는다", () => {
    document.body.innerHTML = `<div role="dialog"><div class="result-error">컴파일 오류</div></div>`;
    expect(isAcceptedResult()).toBe(false);
  });
});
