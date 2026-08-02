# Coding Club

친구들과 함께 사용하는 프로그래머스 코딩테스트 기록 프로젝트입니다. Chrome 확장 프로그램이 문제 페이지에서 실제 풀이 시간을 기록하고, 사용자가 내용을 확인해 업로드 버튼을 누르면 자신의 JSON 파일을 GitHub 저장소의 대상 브랜치에 직접 커밋합니다. GitHub Pages 대시보드는 저장소의 사용자 데이터를 읽어 자동으로 다시 배포됩니다.

별도 서버, 외부 데이터베이스, 일반 회원가입, 관리자 페이지, Pull Request 흐름은 사용하지 않습니다.

## 구조

```text
dashboard/          React + TypeScript + Vite 공개 대시보드
extension/          Chrome Extension Manifest V3
data/users/         GitHub 사용자별 공개 풀이 데이터
packages/shared/    공통 타입, 날짜, 스트릭, 타이머, 기록 병합 로직
scripts/            대시보드용 사용자 데이터 생성
.github/workflows/  GitHub Pages 자동 배포
```

참여자 목록 파일은 따로 관리하지 않습니다. 빌드할 때 `data/users/*.json`을 탐색해 `dashboard/public/data/users/index.json`을 생성합니다. 새로운 collaborator가 첫 기록을 올려 JSON 파일이 생기면 다음 Pages 배포부터 자동으로 표시됩니다.

## 요구 환경

- Node.js 22 이상
- npm 10 이상
- Chrome 최신 버전
- 대상 GitHub 저장소의 collaborator 및 Contents 쓰기 권한

## 설치와 로컬 실행

```bash
npm install
npm run dev
```

대시보드는 기본적으로 `http://localhost:5173`에서 실행됩니다. 실행 전에 실제 `data/users/*.json`을 대시보드 공개 디렉터리로 생성합니다.

전체 테스트와 빌드:

```bash
npm test
npm run typecheck
npm run build
```

대시보드와 확장 프로그램을 따로 빌드할 수도 있습니다.

```bash
npm run build:dashboard
npm run build:extension
```

## Chrome 확장 프로그램 설치

1. `npm run build:extension`을 실행합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위의 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
5. 이 저장소의 `extension/dist` 디렉터리를 선택합니다.
6. 코드를 다시 빌드한 경우 확장 프로그램 카드의 새로고침 버튼을 누릅니다.

확장 프로그램은 다음 주소에서만 content script를 실행합니다.

```text
https://school.programmers.co.kr/learn/courses/*/lessons/*
```

## GitHub 인증 설정

MVP는 서버가 필요 없는 GitHub personal access token 방식을 사용합니다. 일반 OAuth Web Flow는 client secret을 안전하게 보관할 서버가 필요합니다. Device Flow는 client secret 없이 가능하지만 GitHub가 제한된 장치 외에는 신중히 사용하도록 안내합니다.

### 권장: Organization 저장소와 fine-grained PAT

GitHub 공식 문서상 fine-grained PAT는 사용자가 **outside collaborator 또는 다른 개인 계정 저장소의 repository collaborator**인 경우 쓰기 작업을 아직 지원하지 않습니다. 따라서 다음 구성을 권장합니다.

1. 무료 GitHub Organization을 생성
2. 스터디 저장소를 Organization 소유로 생성하거나 이전
3. 세 참여자를 outside collaborator가 아니라 Organization **member**로 추가
4. 참여자에게 저장소 write 권한 부여
5. 각 참여자가 Resource owner를 해당 Organization으로 선택한 fine-grained PAT 생성
6. Organization에서 토큰 승인이 필요하면 owner가 승인

각 사용자는 다음 권한으로 토큰을 생성합니다.

1. GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Resource owner를 스터디 Organization으로 선택
3. Repository access에서 이 스터디 저장소 하나만 선택
4. Repository permissions에서 **Contents: Read and write** 선택
5. 만료 기간을 설정하고 토큰 생성
6. 확장 프로그램 popup에 토큰, owner, repository, branch를 입력
7. **저장하고 연결 확인**을 누름

### 대안: 개인 계정 저장소와 classic PAT

저장소를 한 사람의 개인 계정 소유로 유지하고 친구들을 collaborator로 추가한다면 친구들의 fine-grained PAT는 이 용도로 사용할 수 없습니다. 이때는 personal access token (classic)이 필요합니다.

- public 저장소: `public_repo` 범위
- private 저장소: `repo` 범위

Classic PAT는 선택한 저장소 하나로 범위를 제한할 수 없고 사용자가 접근 가능한 다른 저장소에도 영향을 줄 수 있어 보안상 덜 권장됩니다. 짧은 만료 기간을 설정하고 이 프로젝트에만 사용하는 별도 GitHub 계정이나 Organization 구성을 우선 고려하세요.

토큰이나 client secret은 소스 코드에 들어가지 않습니다. 입력한 PAT는 `chrome.storage.local`에 저장되며 로그와 오류 메시지에 출력하지 않습니다. 다만 `chrome.storage.local`은 운영체제 비밀번호 금고와 동일한 보안 수준이 아닙니다. 신뢰할 수 있는 개인 기기와 Chrome 프로필에서만 사용하고, 토큰 만료 기간을 짧게 설정하며 사용하지 않는 토큰은 폐기하세요.

확장 프로그램은 연결 시 다음을 확인합니다.

- `GET /user`로 현재 인증된 GitHub 사용자
- 대상 저장소 접근 가능 여부
- 저장소 응답의 `permissions.push`
- 업로드 시 인증 사용자 ID와 `data/users/{githubId}.json`의 ID 일치

`permissions.push`가 참이어도 저장소 ruleset이나 branch protection이 직접 커밋을 막으면 실제 업로드는 실패할 수 있습니다. 이 경우 popup에 저장소 권한 오류와 main 직접 커밋 제한 가능성을 함께 안내합니다.

## 사용 흐름

1. GitHub 연결과 저장소 설정
2. 프로그래머스 문제 페이지 진입
3. 페이지 오른쪽 아래 패널에서 스톱워치 자동 시작
4. 필요하면 목표 시간을 설정
5. 목표 시간이 지나면 짧은 알림 후 스톱워치는 계속 기록
6. 정답 결과 영역의 성공 상태 감지
7. 풀이 시간을 멈추고 업로드 대기 기록 생성
8. 풀이 시간과 오늘의 소감 확인 또는 수정
9. 사용자가 **풀이 기록 업로드**를 누름
10. 자신의 JSON 파일만 대상 브랜치에 직접 커밋
11. main 변경 시 GitHub Actions가 대시보드를 다시 배포

정답 감지만으로 GitHub 업로드를 실행하지 않습니다. 자동 감지에 실패하면 **현재 기록 정답 처리**를 누르고 확인 단계를 거칠 수 있습니다.

## 타이머와 여러 탭

타이머 저장 키는 다음과 같습니다.

```text
timer:{githubId}:{problemId}
```

패널은 같은 문제를 연 각 탭에 표시되지만 실제 타이머 상태는 하나만 공유합니다. `chrome.storage.onChanged`를 사용하므로 한 탭의 일시정지, 재개, 정답 처리가 다른 탭에도 반영됩니다. 새로고침, 페이지 이동, Chrome 재시작 뒤에도 상태를 복원합니다.

12시간 이상 지난 타이머에는 기존 시간을 계속 사용할지 지금부터 다시 시작할지 선택하는 안내가 나타납니다. 기준값은 `packages/shared/src/types.ts`의 `DEFAULT_STALE_TIMER_HOURS`에서 바꿀 수 있습니다.

## 사용자 데이터

파일 경로:

```text
data/users/{githubId}.json
```

날짜 키와 일자 판정은 모두 `Asia/Seoul` 기준입니다. 스트릭 값은 JSON에 저장하지 않고 날짜별 문제 기록으로 계산합니다. 동일 사용자·문제 ID·서울 날짜가 같으면 중복으로 판단해 커밋을 만들지 않습니다.

업로드 충돌이 발생하면 최신 SHA와 파일을 다시 읽고 200ms부터 증가하는 짧은 지연을 두어 최대 3회 재시도합니다. 재시도에 실패하면 `chrome.storage.local`의 임시 기록을 삭제하지 않습니다.

문제별 소감은 각 문제마다 하나씩 입력할 수 있으며 최대 500자입니다. HTML로 삽입하지 않고 텍스트로만 렌더링합니다. 이전 버전의 날짜 단위 소감도 대시보드에서 계속 표시합니다.

## GitHub Pages 설정

저장소에서 다음을 설정합니다.

```text
Repository Settings
→ Pages
→ Build and deployment
→ Source: GitHub Actions
```

`.github/workflows/deploy-pages.yml`은 main push 때 다음 작업을 수행합니다.

```text
npm ci
→ data/users/*.json 검증 및 index.json 생성
→ Vite 빌드
→ 생성된 사용자 데이터 존재 확인
→ Pages artifact 업로드
→ GitHub Pages 배포
```

Vite base path는 Actions에서 `GITHUB_REPOSITORY`의 저장소 이름으로 자동 계산합니다. 커스텀 도메인이나 별도 base가 필요하면 빌드 시 `VITE_BASE_PATH`를 설정할 수 있습니다.

확장 프로그램이 main에 직접 커밋해야 하므로 main 직접 push를 막는 branch protection이나 ruleset이 있으면 업로드가 실패합니다. 이 프로젝트에서 직접 커밋을 허용할 collaborator 범위를 저장소 설정에서 확인하세요.

## 프로그래머스 DOM 변경 대응

DOM 관련 선택자와 판별 기준은 `extension/src/programmers-parser.ts`에 모여 있습니다.

- 문제 ID 추출
- 문제 제목 후보 선택자
- URL의 `language` 파라미터(우선)와 선택 언어 후보 선택자
- 채점 결과 컨테이너 후보
- 명시적 성공 상태 판별

단순히 페이지 전체에 `정답` 문자열이 있다는 이유로 성공 처리하지 않습니다. 실제 결과 컨테이너 안에 성공 클래스나 상태 속성이 있고 성공 문구 또는 점수가 함께 있을 때만 처리합니다. 프로그래머스 UI가 변경되면 이 파일과 `programmers-parser.test.ts`를 함께 수정하세요.

## 공개 데이터 주의

GitHub Pages와 public 저장소를 사용하면 다음 정보가 공개됩니다.

- GitHub ID와 프로필 이미지
- 푼 문제와 프로그래머스 URL
- 풀이 날짜와 풀이 시간
- 사용 언어
- 오늘의 소감

민감한 내용이나 개인 식별 정보를 소감에 입력하지 마세요. 저장소가 private이더라도 공개 Pages 산출물에 포함된 데이터는 방문자가 볼 수 있습니다.

## 자주 발생하는 오류

### GitHub 인증이 만료됨

새 access token을 만든 뒤 popup에 다시 입력하고 연결 확인을 실행합니다.

### 저장소를 찾지 못함

owner/repository 철자, 토큰의 Repository access, collaborator 상태를 확인합니다.

### 쓰기 권한이 없음

토큰의 Contents 권한이 `Read and write`인지 확인합니다. 조직 저장소라면 토큰 승인이 보류 중인지도 확인합니다.

### main 직접 커밋이 거절됨

branch protection 또는 ruleset에서 collaborator의 직접 push를 막고 있는지 확인합니다. 필요하면 확장 프로그램의 branch 설정을 바꿀 수 있지만 Pages 자동 배포는 기본적으로 main만 감시합니다.

### 프로그래머스 정보 일부를 가져오지 못함

패널의 경고를 확인합니다. 제목이나 언어 선택자가 바뀌었을 수 있으므로 `extension/src/programmers-parser.ts`의 후보 선택자를 수정하고 테스트합니다.

### GitHub API 충돌

확장 프로그램이 자동으로 제한된 횟수만큼 재조회하고 병합합니다. 실패 메시지가 나오면 임시 기록이 남아 있으므로 popup에서 다시 시도할 수 있습니다.
