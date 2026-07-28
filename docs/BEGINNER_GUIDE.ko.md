# 처음부터 따라 하는 설치·연결·사용 가이드

이 문서는 **Notion Project Docs 스킬을 아직 설치하지 않은 사람**이 자신의
GitHub 저장소 문서를 Notion에 안전하게 발행하기까지의 전체 과정입니다.

처음에는 `manual` 모드로 시작하는 것을 권장합니다. 문서 발행이 익숙해진
뒤에만 `on-main-push` 자동 발행으로 바꾸세요.

## 0. 이 도구가 하는 일

이 도구는 두 가지를 분리합니다.

- GitHub 저장소의 Markdown 문서: 원본이자 수정하는 곳
- Notion 페이지: Git 문서를 보기 좋게 보여 주는 읽기 전용 미러

즉, Notion에서 직접 고치는 대신 저장소의 Markdown을 수정합니다. 검토한
변경이 GitHub Actions를 통과한 경우에만 Notion 페이지가 갱신됩니다.

```text
Markdown 수정 → Pull Request 검토 → main 병합 → 검증 → Notion 미러 갱신
```

## 1. 준비물

다음 네 가지가 필요합니다.

1. 문서를 관리할 GitHub 저장소와 `main` 브랜치
2. Notion 워크스페이스와 문서 미러로 쓸 빈 페이지 2개 이상
3. GitHub 저장소의 Settings를 수정할 권한
4. Codex를 사용할 수 있는 환경

로컬에서 설치기를 직접 실행하려면 Node.js 22.18 이상도 필요합니다.

## 2. Codex에 스킬 설치 요청하기

스킬이 아직 없어도 괜찮습니다. Codex에 아래 문장을 그대로 보내세요.

```text
GitHub 저장소 Yeon-sik/notion-project-docs의
skills/maintain-project-docs 스킬을 설치해줘.
```

설치가 끝나면 **새 Codex 작업**을 열고 아래처럼 요청합니다.

```text
$maintain-project-docs 이 저장소에 Notion 문서 자동화를 설치해줘.
처음에는 manual 모드로 구성하고 싶어.
```

`$maintain-project-docs`를 붙이면 Codex가 이 스킬의 설치·검증 절차를 따릅니다.
스킬을 설치하지 않고 파일만 먼저 살펴보고 싶다면 이 저장소를 clone한 뒤
아래의 로컬 설치기 명령을 사용할 수도 있습니다.

## 3. 대상 저장소에 자동화 파일 설치하기

Codex에 설치를 요청하면 이 단계는 안내받아 진행할 수 있습니다. 직접 실행할
경우에는 clone한 `notion-project-docs` 폴더에서 다음 명령을 실행합니다.

```powershell
node skills\maintain-project-docs\scripts\install-project-docs.mjs `
  --target C:\path\to\your-repository `
  --locale ko `
  --canonical-branch main `
  --publication-mode manual `
  --environment notion-production
```

이 첫 실행은 아무 파일도 만들지 않는 **미리 보기**입니다. 출력에 표시된 경로가
맞고 충돌이 없을 때만 같은 명령 끝에 `--apply`를 붙여 다시 실행합니다.

설치 뒤 대상 저장소에는 아래 파일이 생깁니다.

```text
project-docs.config.json                 어떤 문서를 발행할지 정하는 설정
.github/project-docs/                    검증·Notion 발행 실행 코드
.github/workflows/project-docs-notion.yml GitHub Actions 워크플로
docs/templates/                          문서 시작용 템플릿
```

`project-docs.config.json`의 `documents` 목록에서 실제로 발행할 Markdown
경로와 문서 키를 확인하세요. 기본 한국어 예시는 `intro`, `detail` 키를 씁니다.

## 4. Notion 연결하기

### 가장 간단한 연결 방법

Notion integration을 만든 뒤 프로젝트 문서 미러를 담을 부모 페이지 하나에
integration을 연결합니다. 개별 미러 페이지를 만들거나 페이지 ID를 복사하지
말고 다음 Setup Wizard를 실행합니다.

```powershell
Set-Location C:\path\to\your-repository
node "$env:USERPROFILE\.codex\skills\maintain-project-docs\scripts\setup-project-docs.mjs"
```

열린 브라우저에서 integration token과 부모 페이지 URL을 입력하면 Wizard가
문서별 전용 미러 페이지, GitHub Environment, 기준 브랜치 제한,
`NOTION_TOKEN`, `NOTION_PAGE_IDS_JSON`을 구성합니다. `manual` 모드에서는 현재
GitHub 사용자를 required reviewer로 지정합니다. 저장소와 GitHub 요금제가 이를
지원하지 않아 전용 HTTP 422를 반환하면 보호 규칙 필드를 모두 생략하고 기준
브랜치 제한만 구성한 뒤 완료 화면에 보호 수준 경고를 표시합니다.

GitHub CLI 로그인이 만료됐다면 화면의 **GitHub 로그인/갱신**을 먼저
실행합니다. 일회용 코드는 클립보드에 복사되고 GitHub 인증 창이 열립니다.
창이 열리지 않으면 브라우저에서 `https://github.com/login/device`를 열어
복사된 코드를 붙여 넣으세요. 5분 안에 완료되지 않으면 다시 시도하거나 대상
저장소 터미널에서 아래 명령을 실행합니다.

```powershell
gh auth login --hostname github.com --web --clipboard
```

Wizard를 사용할 수 없는 환경에서는 아래 수동 절차를 따릅니다.

### 4-1. Notion integration 만들기

Notion의 Integrations 관리 화면에서 새 internal integration을 만들고, 문서
내용을 읽고 수정할 수 있는 권한을 부여합니다. 만들어진 **integration token**은
복사하되, Git·Markdown·채팅에 붙여 넣지 마세요.

### 4-2. 미러 전용 페이지 만들기

Notion에 문서마다 빈 페이지를 하나씩 만듭니다. 예를 들어 `프로젝트 소개`,
`프로젝트 상세` 두 페이지를 만듭니다.

각 페이지에서 integration을 공유 대상으로 추가합니다. 이 공유를 하지 않으면
GitHub Actions가 해당 페이지를 읽거나 수정할 수 없습니다.

페이지 URL 끝에 있는 32자리 ID를 기록합니다. 대시가 있어도 괜찮습니다.

## 5. GitHub Secrets와 Environment 연결하기

대상 GitHub 저장소에서 다음을 설정합니다.

1. **Settings → Environments**에서 `notion-production` 환경을 만듭니다.
2. 이 Environment의 배포 브랜치를 `main`으로 제한합니다.
3. Environment secrets에 아래 두 값을 추가합니다.

| 이름 | 넣을 값 |
| --- | --- |
| `NOTION_TOKEN` | 4-1에서 만든 integration token |
| `NOTION_PAGE_IDS_JSON` | 문서 키와 Notion 페이지 ID의 JSON 매핑 |

두 문서의 예시는 다음과 같습니다.

```json
{"intro":"11111111111111111111111111111111","detail":"22222222222222222222222222222222"}
```

왼쪽 키(`intro`, `detail`)는 반드시 `project-docs.config.json`의 `key`와
같아야 합니다. 이 값은 Secret으로만 저장하고 저장소 파일에는 넣지 않습니다.

## 6. 발행 방식 고르기

`project-docs.config.json`의 `publicationMode`가 발행 시점을 결정합니다.

| 모드 | 추천 대상 | Notion이 갱신되는 시점 | Environment 설정 |
| --- | --- | --- | --- |
| `manual` | 처음 사용하는 사람 | Actions에서 `PUBLISH`를 입력해 수동 실행할 때 | 지원 시 required reviewer 설정, 미지원 시 경고 |
| `on-main-push` | PR 검토가 정착된 팀·개인 | 문서 변경이 `main`에 병합될 때 | required reviewer 없이 `main` 제한 유지 |

처음에는 다음처럼 둡니다.

```json
"publicationMode": "manual"
```

자동 발행으로 바꾸려면 다음처럼 수정합니다.

```json
"publicationMode": "on-main-push"
```

자동 모드에서 required reviewer를 남겨 두면 자동 작업이 승인 대기 상태가 됩니다.
자동 발행을 원한다면 reviewer는 제거하고, `main` 브랜치 제한과 Secrets는 유지하세요.

## 7. 처음 발행하기

먼저 대상 저장소에서 문서와 설정을 커밋·push합니다. GitHub의 **Actions** 탭에서
`Validate and publish project docs`를 열어 아래 순서로 실행합니다.

1. `operation`을 `validate`로 선택해 검증만 실행합니다.
2. 성공하면 다시 실행합니다.
3. `operation`을 `publish`로 선택합니다.
4. `confirmation`에 대문자 `PUBLISH`를 정확히 입력합니다.
5. `manual` 모드에서 required reviewer가 구성됐다면 Environment 승인을 완료합니다.

작업이 성공하면 대상 Notion 페이지마다 Git 원본 링크와 source fingerprint가
상단에 표시됩니다.

## 8. 평소에는 어떻게 작업시키면 되나

스킬 설치 뒤 새 Codex 작업에서 아래 요청문을 사용하면 됩니다.

### 새 문서 만들기

```text
$maintain-project-docs 이 저장소를 분석해서 포트폴리오용 소개 문서와
상세 기술 문서를 작성해줘. 검증하지 못한 내용은 미검증으로 표시해줘.
```

### 코드 변경 뒤 문서 갱신

```text
$maintain-project-docs 이번 브랜치의 코드와 테스트 변경을 반영해
설정된 프로젝트 문서를 갱신하고, 발행 전 검증만 실행해줘.
```

### Notion에 발행하기

`manual` 모드라면 문서를 PR로 검토·병합한 뒤 GitHub Actions에서 직접
`PUBLISH`를 입력합니다. `on-main-push` 모드라면 문서 변경 PR을 `main`에
병합하는 것만으로 발행됩니다.

Codex에게는 다음처럼 요청할 수 있습니다.

```text
$maintain-project-docs 설정된 문서를 검증하고, GitHub Actions에서
발행할 준비가 되었는지 확인해줘.
```

## 9. 자주 생기는 문제

| 증상 | 먼저 확인할 것 |
| --- | --- |
| `publish`가 실행되지 않음 | PR 또는 `main` 이외 브랜치에서는 정상적으로 검증만 실행됩니다. 자동 모드는 `main` 병합인지 확인하세요. |
| 자동 발행이 승인 대기 상태 | `on-main-push`인데 Environment required reviewer가 남아 있는지 확인하세요. |
| Notion 페이지를 찾을 수 없음 | 페이지를 integration에 공유했는지, `NOTION_PAGE_IDS_JSON` 키가 설정 파일 키와 같은지 확인하세요. |
| 발행이 전부 실패함 | 두 대상 페이지 모두 읽을 수 있어야 합니다. 하나라도 접근할 수 없으면 안전을 위해 아무 페이지도 수정하지 않습니다. |
| 설치기가 충돌을 표시함 | 기존 파일을 자동으로 덮어쓰지 않습니다. 새 템플릿과 현재 파일을 비교해 필요한 부분만 수동으로 합치세요. |

## 10. 다음에 읽을 문서

- 설정 항목 자세히 보기: [CONFIGURATION.md](../skills/maintain-project-docs/references/CONFIGURATION.md)
- 운영·복구 절차: [OPERATIONS.md](../skills/maintain-project-docs/references/OPERATIONS.md)
- 이 스킬이 문서를 작성하는 기준: [SKILL.md](../skills/maintain-project-docs/SKILL.md)

문서 발행에 실패했을 때는 토큰을 다시 만들기 전에 Actions 로그와 위 표를 먼저
확인하세요. Secret 값은 어떤 로그나 이슈에도 공유하지 않습니다.
