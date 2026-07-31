# Notion Project Docs | Project Detail

> 저장소 근거에서 검토 가능한 프로젝트 문서를 만들고, Git을 원본으로 유지한 채 Notion 미러를 정책적으로 갱신하는 구조와 검증 경계를 설명한다. 빠른 소개는 [Project Intro](./Project_Intro.md)를 참고한다.

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | Active |
| 적용 범위 | v0.2.0, `main`의 기준 구현 커밋 |
| 최종 갱신 | 2026-08-01T02:48:26+09:00 |
| 최종 구현 기준 | [`e4210092ff61ad27038347f72deb2e79bbe4994c`](https://github.com/Yeon-sik/notion-project-docs/tree/e4210092ff61ad27038347f72deb2e79bbe4994c) |
| 문서 진실 원천 | Git 저장소의 `docs/Project_Detail.md` |
| 공개 상태 | GitHub 공개 저장소, universal Plugins Directory 미제출 |

---

## 1. 문서 목적과 범위

### 포함

- `$maintain-project-docs` 스킬의 증거 기반 문서 작성 절차
- 대상 저장소에 고정되는 설정·검증기·발행기·GitHub Actions 번들
- 로컬 Setup Wizard의 Notion 페이지 및 GitHub Environment 구성 경계
- 최초 1회 발행과 이후 `manual` / `on-main-push` 발행 정책
- 현재 저장소에서 확인 가능한 테스트, 보안 불변식, 실패 복구 방식

### 제외

- 특정 사용자의 비공개 프로젝트 문서와 Notion 페이지 내용
- Notion 또는 GitHub의 실제 토큰·페이지 ID·Environment 값
- 실제 토큰·page map 값과 미러 페이지 밖의 비공개 Notion 콘텐츠
- universal Plugins Directory 심사·배포 결과

이 문서의 구현 주장은 기준 커밋의 추적 파일, 로컬 검사, 연결된 GitHub Actions 실행과 Notion read-back 결과에 한정한다. 현재 저장소의 수동 발행 경로는 실환경 확인했지만 Setup Wizard 최초 연결, 동일 revision 재실행, 부분 실패 복구와 다른 권한 조합은 별도 검증 항목으로 남긴다.

## 2. 문제 맥락과 제약

### 문제

프로젝트 문서가 코드와 분리되면 구현되지 않은 기능, 오래된 수치, 검증되지 않은 배포 상태가 소개 문서에 남기 쉽다. 반대로 정확성만 강조하면 외부 독자가 이해하기 어려운 파일 목록이 된다. Git과 Notion을 동시에 편집 가능한 원본으로 운영할 때는 리뷰와 복구 기준도 둘로 갈라진다.

### 핵심 제약

- 문서 주장은 저장소, 실행 환경, 사용자 확인, 추론, 계획 중 어느 근거인지 구분해야 한다.
- 플러그인은 사용자 비밀값을 중계하는 백엔드 서비스를 운영하지 않는다.
- 대상 저장소는 기존 문서와 워크플로를 보존해야 하며 설치기가 임의로 덮어쓰면 안 된다.
- Notion API는 여러 페이지를 하나의 원자적 트랜잭션으로 교체하지 못한다.
- GitHub 요금제에 따라 Environment required reviewer를 사용할 수 없는 경우가 있다.
- Node.js 22.18 이상을 사용하며 서드파티 런타임 패키지 없이 동작해야 한다.

### 성공 기준

| 기준 | 판정 방법 |
| --- | --- |
| 문서 무결성 | 필수 섹션, placeholder, 링크, 로컬 경로, 일반 credential 패턴 검사 |
| 설치 안전성 | 기본 dry run, 전체 목적지 충돌 검사, 동일 번들의 idempotent 재설치 테스트 |
| 발행 안전성 | canonical branch, 승인 정책, 전체 대상 preflight, fingerprint와 응답 검증 |
| 비밀값 경계 | 저장소·URL·명령 인수·브라우저 저장소에 token/page map 미기록 |
| 복구 가능성 | 동일 revision 재실행 시 이미 일치하는 페이지를 건너뛰고 불일치만 수렴 |

## 3. 사용자와 핵심 흐름

| 사용자 | 목표 | 핵심 흐름 |
| --- | --- | --- |
| 프로젝트 소유자 | 근거가 있는 포트폴리오 문서 작성 | 저장소 지정 → 증거 조사 → 개요·상세 작성 → 로컬 검증 → Git 리뷰 |
| 저장소 관리자 | 기존 파일을 보존하며 자동화 설치 | 설치 dry run → 경로·충돌 검토 → 명시적 `--apply` → 번들 검증 |
| 문서 운영자 | 검토된 Markdown을 Notion에 반영 | Actions validate → 정책 승인 → 전체 preflight → 전용 페이지 교체 → 결과 확인 |
| 최초 설정 사용자 | 토큰과 페이지 ID를 직접 옮기는 작업 축소 | loopback Wizard → 부모 페이지 확인 → 미러 페이지 생성/재사용 → Environment secret 구성 |

```text
[Repository evidence]
  → [Codex skill: classify and write]
  → [Tracked Markdown]
  → [Validator + render-only dry run]
  → [Git review / canonical branch]
  → [GitHub Actions publication policy]
  → [Notion full-page preflight]
  → [Replace dedicated mirror pages]
  → [Fingerprint and response verification]
```

## 4. 범위와 구현 현황

| 기능 | 구현 상태 | 검증 수준 | 환경·기준 | 확인된 근거 | 남은 위험 |
| --- | --- | --- | --- | --- | --- |
| 증거 기반 문서 작성 지침 | 구현 완료 | 저장소 검증 | `e421009` | [SKILL.md](../skills/maintain-project-docs/SKILL.md), [EVIDENCE_MODEL.md](../skills/maintain-project-docs/references/EVIDENCE_MODEL.md) | 에이전트가 실제로 모든 주장을 올바르게 분류하는지는 작업별 리뷰 필요 |
| 비파괴 설치기 | 구현 완료 | 저장소 검증 | `e421009`, 로컬 테스트 | [install-project-docs.mjs](../skills/maintain-project-docs/scripts/install-project-docs.mjs) | 사용자 정의 파일과의 의미적 병합은 자동화하지 않음 |
| 문서 검증기 | 구현 완료 | 저장소 검증 | `e421009`, 로컬 테스트 | [validate-project-docs.mjs](../skills/maintain-project-docs/scripts/validate-project-docs.mjs) | 모든 비밀값 형식을 완전 탐지하는 DLP 도구는 아님 |
| Notion Markdown 발행기 | 구현 완료 | 저장소 테스트 + 실제 수동 발행 | `9c3fefa`, Node 테스트, [Actions 실행](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657348898) | [sync-project-docs-to-notion.mjs](../skills/maintain-project-docs/scripts/sync-project-docs-to-notion.mjs), Notion read-back | 현재 계정·페이지 조합 외 권한·네트워크 조합은 미검증 |
| Setup Wizard | 구현 완료 | stub 기반 저장소 검증 + 기존 원격 구성 확인 | `9c3fefa`, Node 테스트, `notion-production` 구성 메타데이터 | [setup-project-docs.mjs](../skills/maintain-project-docs/scripts/setup-project-docs.mjs) | 최신 `--target` 흐름의 브라우저 최초 연결 E2E는 미실행 |
| 정책 기반 GitHub Actions | 구현 완료 | 실제 validate·승인·publish 검증 | `9c3fefa`, [validate](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657316182), [publish](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657348898) | [workflow template](../skills/maintain-project-docs/assets/project-docs-notion.workflow.yml) | 다른 저장소의 branch/environment 정책은 별도 확인 필요 |
| universal Plugins Directory 배포 | 미제출 | 미검증 | 2026-08-01 | [README](../README.md) | 설치 발견성과 공식 배포 검증 미확보 |

## 5. 시스템 아키텍처

```text
[Codex]
   │ reads repository evidence
   ▼
[maintain-project-docs skill + templates]
   │ creates reviewed Markdown
   ▼
[Target repository]
   ├─ project-docs.config.json
   ├─ docs/*.md
   ├─ .github/project-docs/* (pinned runtime)
   └─ .github/workflows/project-docs-notion.yml
          │
          ├─ validate / render-only dry run
          └─ policy-approved publish
                    │
                    ▼
          [Dedicated Notion mirror pages]
```

### 컴포넌트 책임

| 컴포넌트 | 책임 | 의존성 | 실패 시 영향 |
| --- | --- | --- | --- |
| Codex skill | 증거 조사 순서, 주장 분류, 문서 작성·검증 규칙 제공 | 저장소 파일, 사용자 요청 | 부정확하거나 과장된 문서 가능 |
| Installer | 설정·템플릿·고정 런타임·workflow 설치 계획과 적용 | 파일 시스템 | 대상 저장소 자동화 미설치 또는 충돌 중단 |
| Config loader | branch, publication mode, 문서 key/path/section 불변식 검증 | JSON 설정 | 검증·발행 시작 전 중단 |
| Validator | Markdown 구조·링크·placeholder·경로·비밀값 후보 검사 | Git, 로컬 파일 | 잘못된 문서가 CI를 통과할 위험 |
| Setup Wizard | loopback UI, Notion 페이지 준비, GitHub 환경 구성 조정 | 브라우저, GitHub CLI, Notion API | 초기 연결 중단, 본문 발행은 별도 경계로 유지 |
| Initial publisher | clean/tracked canonical source와 remote tip 확인, Git 객체 기반 최초 발행 | Git, GitHub, publisher | 조건 불일치 시 최초 본문 미발행 |
| Publisher | 전체 페이지 preflight, 렌더, 교체, fingerprint 검증 | Notion API | 일부 실패 시 작업 실패 보고, 동일 SHA 재실행 필요 |
| GitHub Actions | 검증과 발행 권한·시점 분리 | GitHub runner/environment | 잘못된 정책이면 발행 대기 또는 차단 |

### 데이터 흐름

1. `project-docs.config.json`이 canonical branch, 발행 모드, 문서 key와 Git 경로를 정의한다.
2. 검증기가 각 Markdown을 읽어 필수 섹션과 공개 안전성을 검사한다.
3. dry run은 문서 링크를 Notion 페이지 또는 immutable GitHub asset 링크로 변환하고 source metadata를 포함한 결과를 렌더한다.
4. 실제 발행은 Environment secret의 token과 page map을 검증한 뒤 모든 페이지를 먼저 읽는다.
5. 모든 preflight가 통과하면 불일치 페이지만 `replace_content` 방식으로 교체한다.
6. 응답의 페이지 식별자와 source fingerprint를 확인하고 GitHub Actions summary에 결과를 남긴다.

## 6. 도메인 모델과 불변식

### 핵심 엔터티

| 엔터티 | 식별자 | 진실 원천 | 변경 가능 여부 |
| --- | --- | --- | --- |
| Project docs configuration | config version + repository path | Git의 `project-docs.config.json` | 리뷰된 Git 변경으로만 수정 |
| Document | lower-case `key` + 유일한 Markdown path | Git 추적 파일 | 문서 작성·리뷰로 변경 |
| Publication source | commit SHA + repository + branch | 검증된 Git 객체 | 발행 실행 중 불변 |
| Notion destination | document key → 32자리 page ID | GitHub Environment secret | 저장소 밖에서 관리 |
| Device connection default | Notion token + 최근 parent URL | OS 사용자 설정 디렉터리 | 성공한 setup 이후 교체 가능 |

### 불변식

1. 문서 경로는 저장소 내부의 `.md` 파일이어야 하고 key와 path는 중복될 수 없다.
2. 하나의 Notion page ID를 여러 문서가 공유할 수 없다.
3. 일반 검증과 render-only dry run은 Notion에 쓰지 않는다.
4. `manual` 발행은 정확한 `PUBLISH` 입력과 canonical branch 조건을 요구한다.
5. `on-main-push` 자동 발행은 설정된 canonical branch push에서만 가능하다.
6. 한 페이지라도 접근 불가·잘림·식별 불일치가 있으면 첫 쓰기 전에 전체 발행을 중단한다.
7. 최초 발행은 clean/tracked 문서, canonical checkout, local HEAD와 remote canonical tip 일치를 요구하며 쓰기 직전에 다시 확인한다.
8. 토큰과 page map은 Git, 브라우저 저장소, URL, 명령 인수에 기록하지 않는다.

## 7. 핵심 기술 의사결정

### 결정 1. Git Markdown을 단일 원본으로 유지

- **상황**: Git과 Notion을 동시에 편집하면 최신성과 리뷰 책임이 분산된다.
- **검토한 대안**: Notion 원본 후 Git export, 양방향 동기화, Git 원본 단방향 미러.
- **선택**: Git 원본 단방향 미러.
- **근거**: 코드 revision과 문서 revision을 함께 검토하고, 승인·복구를 기존 Git 흐름에 연결할 수 있다.
- **비용과 위험**: Notion 전용 페이지의 수동 편집은 다음 발행에서 교체되므로 협업 메모는 별도 페이지에 두어야 한다.
- **재검토 조건**: 양방향 편집이 필수 제품 요구가 되면 충돌 해결 모델과 권한 감사 체계부터 별도 설계한다.

### 결정 2. 대상 저장소에 dependency-free 런타임을 고정 설치

- **상황**: 실행 시점의 로컬 플러그인 버전에 의존하면 동일 커밋의 CI 결과가 달라질 수 있다.
- **검토한 대안**: 중앙 서비스 호출, npm 패키지 최신 버전 참조, 저장소 고정 복사본.
- **선택**: 설정 loader, validator, publisher, schema, workflow를 대상 저장소에 고정한다.
- **근거**: 리뷰된 코드가 그대로 CI에서 실행되고 외부 패키지 공급망과 버전 drift를 줄인다.
- **비용과 위험**: 업그레이드가 자동이 아니며 충돌을 사람이 검토해야 한다.
- **재검토 조건**: 설치 대상이 크게 늘어 업그레이드 비용이 검토 이점을 넘으면 서명된 버전 패키지 전략을 검토한다.

### 결정 3. 수동 발행을 기본값으로 유지

- **상황**: 문서 push가 즉시 외부 페이지를 덮어쓰면 검토되지 않은 정보가 공개될 수 있다.
- **선택**: `manual` 기본값, exact `PUBLISH`, canonical branch, 가능한 경우 Environment reviewer를 요구한다. 자동 발행은 소유자가 `on-main-push`를 명시할 때만 활성화한다.
- **결과**: 초기 설정 비용은 늘지만 외부 쓰기 권한과 문서 변경을 분리할 수 있다.
- **재검토 조건**: 안정된 리뷰 프로세스와 자동 발행 요구가 확인된 저장소만 모드를 변경한다.

### 결정 4. 원자성 대신 전체 preflight와 idempotent 재실행 사용

- **상황**: Notion은 여러 페이지를 하나의 트랜잭션으로 교체하지 않는다.
- **선택**: 쓰기 전에 모든 페이지를 읽고, 이미 같은 내용은 건너뛰며, 부분 실패 시 같은 source commit을 재실행한다.
- **결과**: 첫 쓰기 전 오류는 전체 중단할 수 있고, 네트워크 중간 실패는 재실행으로 수렴한다.
- **잔여 위험**: 첫 PATCH 이후 서비스 장애가 나면 일시적으로 페이지 revision이 섞일 수 있다.

### 결정 5. 최초 발행은 mutable working tree가 아닌 Git 객체에서 렌더

- **상황**: source SHA 확인 후 파일이 바뀌면 이전 SHA 라벨로 새 내용을 발행할 수 있다.
- **선택**: `git show <sha>:<path>`로 설정과 Markdown을 읽고, 실제 쓰기 직전에 branch·HEAD·remote tip을 재검증한다.
- **결과**: 발행된 fingerprint와 표시된 source commit의 결합이 강화된다.

## 8. 외부 연동과 실패 경계

| 연동 대상 | 목적 | 인증/비밀값 | 실패 처리 | 재시도/제한 | 이번 세션 실환경 확인 |
| --- | --- | --- | --- | --- | --- |
| Notion API | 부모 확인, 미러 페이지 준비, Markdown 조회·교체 | integration token | 오류 본문을 안전하게 제한해 보고, preflight 실패 시 무쓰기 | 요청 재시도와 동일 revision 재실행 | Actions에서 2개 페이지 교체 성공, connector read-back으로 제목·source commit·본문 확인 |
| GitHub API/CLI | 저장소 식별, Environment 정책, secret 저장, remote tip 확인 | GitHub CLI 인증 | 인증 만료 시 브라우저 device flow, reviewer 요금제 422만 제한적 fallback | 인증 5분 timeout, 다른 오류는 숨기지 않음 | Environment 메타데이터·secret 이름 확인, validate·publish dispatch와 보호 환경 승인 성공 |
| Git | 추적 상태, branch, commit snapshot, remote 일치 확인 | 저장소 권한 | dirty/non-canonical/diverged 상태에서 최초 발행 중단 | 상태 정리 후 다시 실행 | `main`의 `9c3fefa`를 source commit으로 발행 확인 |
| 로컬 브라우저 | loopback Setup Wizard 표시 | 브라우저에는 token 존재 여부만 전달 | origin 불일치 거부, 성공 또는 timeout 후 종료 | 사용자가 재실행 | 미실행 |

## 9. 데이터 보호와 보안

| 경계 | 정책 | 저장소 검증 방법 |
| --- | --- | --- |
| publishable Markdown | 개인 식별자, 로컬 절대 경로, credential 후보 제외 | validator와 distribution scan |
| Notion token | URL·Git·로그·브라우저 저장소 금지 | setup 구현과 회귀 테스트 |
| page ID map | Git 파일이 아닌 protected Environment secret | 구성 loader와 workflow |
| GitHub secret 입력 | CLI stdin으로만 전달 | `github-provisioner.mjs`와 테스트 |
| Setup UI | `127.0.0.1` bind, strict origin, CSP/security headers | distribution validation과 setup 테스트 |
| 미러 페이지 소유권 | 선택한 parent의 정확한 `[Git Mirror]` 페이지, blank 또는 fingerprinted content만 재사용 | Notion provisioning preflight 테스트 |

### 위협과 대응

- 잘못된 페이지 ID로 수동 문서 덮어쓰기 → parent·title·page ID·완전한 Markdown을 사전 확인 → 현재 구성은 발행 후 제목·source commit·본문 read-back으로 확인, 다른 권한 조합은 별도 필요
- source SHA와 실제 본문 불일치 → Git 객체 snapshot 렌더 + 쓰기 직전 remote tip 재검증
- 브라우저 또는 명령 기록으로 token 노출 → token 본문 미삽입 + stdin secret 전달 + browser storage 미사용
- 요금제 제한을 일반 오류처럼 무시 → required reviewer 관련 특정 422만 branch-policy fallback, 다른 오류는 중단

## 10. 테스트와 검증 전략

| 수준 | 도구 | 검증 대상 | 현재 상태 |
| --- | --- | --- | --- |
| 배포 구성 검사 | Node.js 스크립트 | 필수 파일, manifest, workflow gate, Unicode, 사용자 경로 | 필수 배포 파일 29개 확인 통과 |
| 단위 테스트 | `node:test` | config/path 불변식, 링크 렌더, page ID, 상태 파일 | 포함된 전체 테스트와 함께 45/45 통과 |
| 통합 테스트 | `node:test` + stubbed fetch/CLI | 설치 idempotency, 전체 preflight, setup, 초기 발행, 인증 fallback | 포함된 전체 테스트와 함께 45/45 통과 |
| 문서 검사 | 내장 project-docs validator | 신규 문서의 구조, placeholder, 링크, 로컬 경로, credential 후보 | 문서 2개, 오류 0·경고 0 |
| Project-docs workflow | GitHub Actions | canonical `main` 검증, 보호 환경 승인, Notion 발행 | validate와 publish 실행 성공 |
| 운영 E2E | 실제 GitHub/Notion | validate → 승인 → manual publish → read-back | 현재 저장소에서 성공, Setup Wizard 최초 연결·동일 revision 재실행·부분 실패 복구는 미실행 |

### 검증 이력

| 일시 | 기준 | 명령/환경 | 결과 | 근거 위치 | 미검증 항목 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-01 | `9c3fefa` + docs-only 작업 트리 | `npm.cmd run check`, Windows, Node 22.18+ | 통과: 배포 파일 29개, 테스트 45/45 | 로컬 명령 출력 | 다른 OS의 로컬 실행 |
| 2026-08-01 | docs-only 작업 트리 | `node skills/maintain-project-docs/scripts/validate-project-docs.mjs docs/Project_Intro.md docs/Project_Detail.md` | 통과: 오류 0, 경고 0 | 로컬 명령 출력 | Notion 렌더 시각 결과 |
| 2026-08-01 | docs-only 작업 트리 | `git diff --check` | 통과, 공백 오류 없음 | 로컬 명령 출력 | 플랫폼별 line ending 변환 여부 |
| 2026-08-01 | `9c3fefa` | [GitHub Actions validate](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657316182) | 성공 | Actions run | Setup Wizard 최초 연결 |
| 2026-08-01 | `9c3fefa` | [GitHub Actions manual publish](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657348898) + Notion read-back | 성공: 2개 페이지 동기화, 제목·source commit·본문 확인 | Actions log와 연결된 Notion workspace | 동일 revision 재실행과 부분 실패 복구 |

실제 수동 발행 성공은 현재 저장소·계정·페이지·보호 환경 조합을 검증한다. 모든 계정·요금제·권한 조합이나 Setup Wizard·복구 경로까지 일반화하지 않는다.

## 11. 배포·운영·복구

```text
[Document change]
  → [Pull request / push validation]
  → [Canonical branch]
  → [manual: workflow_dispatch + PUBLISH + optional approval]
     or [on-main-push: matching canonical push]
  → [Notion preflight]
  → [Replace + verify]
  → [Actions summary]
```

- **배포 조건**: 추적된 문서와 런타임, 설정 검증 통과, canonical branch 정책 충족.
- **관찰 항목**: GitHub Actions summary의 문서별 skipped/updated/failed 결과와 source fingerprint.
- **백업**: Git commit이 문서 원본과 복구 지점이며 Notion은 백업 원본으로 취급하지 않는다.
- **복구**: 실패한 동일 commit을 다시 실행해 이미 일치하는 페이지는 건너뛰고 남은 페이지를 수렴시킨다.
- **롤백**: 원하는 과거 Git 문서를 새 검토 commit으로 되돌린 뒤 정상 발행 정책을 다시 실행한다.
- **금지 경로**: 토큰을 로컬 명령 인수로 넘겨 보호 정책을 우회한 직접 `--apply` 실행.

## 12. 문제 해결 사례

### GitHub 요금제가 required reviewer를 지원하지 않는 경우

- **증상**: Setup Wizard가 Environment 보호 규칙 구성 중 plan-specific HTTP 422를 받는다.
- **원인**: 현재 저장소 요금제가 required reviewer 설정을 지원하지 않는다.
- **해결**: 해당 오류에만 reviewer 필드를 모두 제외하고 canonical branch deployment policy로 다시 구성하며, 보호 수준 감소를 화면에 표시한다.
- **회귀 방지**: [setup-project-docs.test.mjs](../skills/maintain-project-docs/scripts/setup-project-docs.test.mjs)가 특정 422 fallback과 다른 오류의 비은폐를 각각 검사한다.

### 최초 발행 직전 Git 상태가 바뀌는 경우

- **증상**: 확인한 source SHA와 실제 발행 직전 checkout이 달라질 수 있다.
- **원인**: 검증과 외부 쓰기 사이에 branch, HEAD 또는 remote canonical tip이 이동하는 경쟁 조건이 있다.
- **해결**: committed Git snapshot으로 렌더하고 첫 쓰기 직전에 세 상태를 다시 비교한다.
- **회귀 방지**: 초기 발행 source 재검사와 immutable snapshot 테스트가 포함되어 있다.

## 13. 한계, 기술 부채, 다음 단계

| 우선순위 | 항목 | 사용자/운영 영향 | 다음 행동 |
| --- | --- | --- | --- |
| P1 | Setup Wizard·재실행·복구 E2E 증거 부족 | 수동 발행 외 경로는 권한·요금제·API 변화가 stub 테스트 밖에서 실패할 수 있음 | 폐기 가능한 저장소·Notion parent에서 최초 setup, 동일 revision 재실행, 부분 실패 복구를 기록 |
| P1 | Notion 다중 페이지 비원자성 | 중간 장애 시 일시적으로 서로 다른 revision 노출 가능 | 동일 SHA 자동 재실행 절차와 partial failure 경보를 실제 workflow에서 검증 |
| P2 | universal Plugins Directory 미제출 | 설치 발견성과 공식 검증 상태 제한 | 공식 plugin/skill validator를 재실행하고 제출 체크리스트 완료 |
| P2 | 정규식 기반 공개 안전성 검사 | 알려지지 않은 비밀값 형식은 놓칠 수 있음 | 실제 유출 사례가 확인될 때 탐지 규칙과 테스트 fixture 추가 |

지금 해야 할 한 가지는 폐기 가능한 대상에서 최신 `--target` Setup Wizard 최초 연결과 동일 revision 복구 시나리오를 실행해 남은 운영 불확실성을 줄이는 것이다.

## 14. 배운 점과 재설계 방향

- **유지할 결정**: Git 원본, 수동 발행 기본값, 전체 preflight, immutable source snapshot, 비파괴 설치.
- **바꿀 결정**: 실제 사용 저장소가 늘어나면 고정 런타임 업그레이드의 수동 비교 비용을 줄일 수 있는 서명된 버전 manifest를 먼저 검토한다. 현재는 계획이며 구현되지 않았다.
- **추가 검증이 필요한 가설**: device-wide token 재사용이 여러 저장소 설정 시간을 줄이면서도 OS별 권한 모델에서 충분한 보안성을 유지하는지 실환경 관찰이 필요하다.

## 15. 관련 문서

- [Project Intro](./Project_Intro.md)
- [README](../README.md)
- [한국어 README](../README.ko.md)
- [Architecture](./ARCHITECTURE.md)
- [Beginner Guide](./BEGINNER_GUIDE.ko.md)
- [Evaluation Cases](./EVALUATIONS.md)
- [Release Checklist](./RELEASE_CHECKLIST.md)
- [Configuration Reference](../skills/maintain-project-docs/references/CONFIGURATION.md)
- [Evidence Model](../skills/maintain-project-docs/references/EVIDENCE_MODEL.md)
- [Operations Runbook](../skills/maintain-project-docs/references/OPERATIONS.md)
