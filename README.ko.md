# Notion Project Docs

저장소의 구현·테스트 근거를 프로젝트 문서로 정리하고, 검토가 끝난 Git
Markdown만 전용 Notion 페이지에 미러링하는 Codex 스킬 플러그인입니다.

> 현재 상태: v0.2.0이 이 공개 GitHub 저장소에 발행되었습니다. universal
> Plugins Directory에는 아직 제출하지 않았습니다.

[English](./README.md)

## 처음이라면 이 문서부터 읽으세요

Codex 스킬·Notion integration·GitHub Actions가 처음이라면 설치와 연결을
시작하기 전에 [처음부터 따라 하는 설치·연결·사용 가이드](./docs/BEGINNER_GUIDE.ko.md)를
읽으세요. 스킬 설치 요청문, Notion·GitHub 설정, 첫 발행, 평소 작업 요청문과
문제 해결 방법을 순서대로 안내합니다.

이 저장소 자체의 문제·설계·검증 경계는 [프로젝트 소개](./docs/Project_Intro.md)와
[기술 사례 연구](./docs/Project_Detail.md)에 근거 중심으로 정리했습니다.

## 핵심 목적

- 포트폴리오용 프로젝트 소개와 기술 사례 문서를 근거 기반으로 작성
- 코드·테스트·배포 기록과 문서 주장 사이의 불일치 방지
- Git Markdown을 진실 원천으로 유지
- Notion을 수동 편집 원본이 아닌 승인된 읽기용 미러로 사용
- 여러 프로젝트와 문서 이름을 JSON 설정으로 재사용
- 최초 1회 저장한 기기 전용 토큰과 최근 부모 페이지 URL을 재사용하는 로컬
  Setup Wizard로 Notion 미러 페이지와 GitHub Environment Secret을 자동
  구성하고, 선택 시 최초 본문까지 게시

## 안전한 공개 흐름

기본값인 `manual`에서는 pull request와 일반 push가 문서 검증과 렌더링만
실행합니다. Notion 쓰기는 다음 조건이 모두 만족될 때만 가능합니다.

1. 사용자가 GitHub Actions의 수동 실행을 시작합니다.
2. 작업을 `publish`로 선택합니다.
3. 확인란에 정확히 `PUBLISH`를 입력합니다.
4. 저장소와 요금제가 required reviewer를 지원하면 보호된 GitHub
   Environment의 승인을 통과합니다.
5. 실행 브랜치가 설정된 기준 브랜치와 일치합니다.
6. 모든 Notion 대상 페이지의 읽기 사전 점검이 성공합니다.

예외는 연결 Wizard에서 명시적으로 선택하는 최초 1회 게시뿐입니다. 이 경로도
설정된 기준 브랜치의 Git 추적·커밋 상태, 문서 검증, 전체 Notion 페이지 사전
점검과 source fingerprint 검증을 모두 요구합니다. 연결 이후의 모든 변경은
다시 위 GitHub Actions 정책을 따릅니다.

저장소 소유자가 `publicationMode`를 `on-main-push`로 명시하면, pull
request에서는 계속 검증만 수행하고 기준 브랜치에 병합된 문서 변경은
자동으로 Notion에 발행됩니다. 이 모드에서도 Environment Secret,
기준 브랜치 제한, 전체 페이지 사전 점검과 멱등성 검사는 유지합니다.

## 대상 저장소에 적용

처음 사용하는 경우에는 아래 명령보다 먼저
[초보자 가이드](./docs/BEGINNER_GUIDE.ko.md)를 따라 설치·연결을 완료하세요.

먼저 쓰기 없는 설치 계획을 확인합니다.

```powershell
node skills\maintain-project-docs\scripts\install-project-docs.mjs `
  --target C:\path\to\repository `
  --locale ko `
  --canonical-branch main `
  --publication-mode manual `
  --environment notion-production
```

충돌이 없고 경로가 의도와 맞으면 `--apply`를 추가합니다. 설치기는 기존
파일이 다르면 덮어쓰지 않고 전체 사전 점검 단계에서 중단합니다.

이후 `$maintain-project-docs`로 설정된 문서를 작성·검증하고 설치 파일과 함께
기준 브랜치에 커밋합니다. 다음 GitHub Environment Secret은 직접 GitHub
Settings에서 입력하는 대신 Notion integration을 연결한 부모 페이지 하나를
만든 뒤 Wizard로 구성할 수 있습니다.

```powershell
Set-Location C:\path\to\repository
node "$env:USERPROFILE\.codex\skills\maintain-project-docs\scripts\setup-project-docs.mjs"
```

첫 연결에서는 Notion integration token과 부모 페이지 URL을 입력합니다. 연결이
성공하면 토큰은 현재 기기의 사용자 설정에 저장되어 다른 저장소의 Wizard에서도
자동으로 사용됩니다. 이후 토큰 입력란을 비워 두면 저장된 토큰을 사용하고, 새
토큰을 입력하면 성공 후 기존 값을 교체합니다. 부모 페이지 URL은 실행할 때마다
바꿀 수 있으며 비워 두면 직전에 성공한 페이지 주소를 사용합니다.

Wizard가 문서별 전용 하위 페이지를 만들고, 기준 브랜치로 제한된 GitHub
Environment와 아래 두 Secret을 구성합니다. 기본 선택된 **최초 본문 즉시
게시**를 유지하면, 현재 체크아웃이 기준 브랜치이고 설정과 문서가 Git 커밋과
일치하며 검증을 통과하고 그 커밋이 GitHub 기준 브랜치의 현재 끝과 같을 때 같은
연결 과정에서 페이지 본문까지 채웁니다. 본문 쓰기 없이 연결만 하려면 이 선택을
해제합니다. 토큰과 페이지 ID 매핑은 저장소, 브라우저 저장소, 명령행 인수에
기록하지 않습니다. 재사용 토큰과 최근 부모 페이지 URL만 OS 사용자 설정
디렉터리의 `notion-project-docs/connection-state.json`에 기록되며, 저장된 토큰
원문은 브라우저 HTML로 전달되지 않습니다. 이 파일을 삭제하면 로컬 기본값만
초기화되고 GitHub Environment Secret은 별도로 유지됩니다.

- `NOTION_TOKEN`: Notion integration token
- `NOTION_PAGE_IDS_JSON`: 문서 키와 전용 Notion 페이지 ID의 JSON 매핑

예:

```json
{"intro":"11111111111111111111111111111111","detail":"22222222222222222222222222222222"}
```

`manual` 모드는 GitHub 저장소와 요금제가 지원할 때 Environment required
reviewer를 사용합니다. GitHub가 요금제 제한 HTTP 422를 반환하면 Wizard는
지원하지 않는 보호 규칙 필드를 모두 빼고 기준 브랜치 정책만으로 다시 구성한 뒤,
보호 수준이 낮아졌다는 경고를 완료 화면에 표시합니다. 이 경우에도 정확한
`PUBLISH` 확인은 유지되지만 별도 Environment 승인은 없습니다.
`on-main-push` 모드는 자동 발행을 위해 required reviewer를 두지 않고
배포 브랜치를 `main`으로 제한합니다. 수동 `PUBLISH` 실행은 복구 경로로
계속 사용할 수 있습니다.

GitHub CLI 로그인이 만료됐다면 **GitHub 로그인/갱신**을 누릅니다. 일회용 코드가
클립보드에 복사되고 브라우저 인증 창이 열립니다. 인증이 5분 안에 끝나지 않으면
Wizard가 오류를 표시하므로 버튼을 다시 누르거나 터미널에서
`gh auth login --hostname github.com --web --clipboard`를 실행합니다.

상세 설정은 [CONFIGURATION.md](./skills/maintain-project-docs/references/CONFIGURATION.md),
운영 절차는 [OPERATIONS.md](./skills/maintain-project-docs/references/OPERATIONS.md)를
참고합니다.

## 개발 검증

Node.js 22.18 이상이 필요하며 외부 런타임 패키지는 사용하지 않습니다.

```powershell
npm run check
```

배포 전에는 [릴리스 체크리스트](./docs/RELEASE_CHECKLIST.md)를 완료해야
합니다.

## 라이선스

[MIT](./LICENSE)
