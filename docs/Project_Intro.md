# Notion Project Docs | 근거가 남는 프로젝트 문서를 안전하게 Notion까지 연결

> 저장소의 코드·테스트·설정을 근거로 프로젝트 소개와 기술 사례 문서를 만들고, 검토된 Git Markdown만 전용 Notion 페이지에 미러링하는 Codex 플러그인이다.

| 항목 | 내용 |
| --- | --- |
| 프로젝트 형태 | 공개 Codex 플러그인, Node.js CLI, GitHub Actions 템플릿 |
| 현재 상태 | v0.2.0 공개 저장소 배포, universal Plugins Directory 미제출 |
| 문서 기준 | [`e4210092ff61ad27038347f72deb2e79bbe4994c`](https://github.com/Yeon-sik/notion-project-docs/tree/e4210092ff61ad27038347f72deb2e79bbe4994c) |
| 주요 기술 | Codex Skills, Node.js ESM, GitHub Actions, Notion API, JSON Schema |
| 실행 조건 | Node.js 22.18 이상, 서드파티 런타임 의존성 없음 |
| Repository | [Yeon-sik/notion-project-docs](https://github.com/Yeon-sik/notion-project-docs) |
| 상세 문서 | [Project Detail](./Project_Detail.md) |

---

## 1. 30초 요약

- **문제**: 프로젝트 문서는 코드와 멀어지기 쉽고, Notion을 별도 원본처럼 직접 수정하면 검토 이력과 실제 구현 근거가 분리된다.
- **해결**: Git Markdown을 단일 진실 원천으로 두고, Codex가 증거 경계를 지켜 문서를 작성하도록 안내한다. 설치된 검증기와 GitHub Actions는 구조·링크·비밀값을 검사하고 승인된 문서만 Notion 전용 페이지에 반영한다.
- **핵심 결과**: 비파괴 설치기, 한국어·영어 템플릿, 로컬 Setup Wizard, 정책 기반 CI, 전체 페이지 사전 점검과 source fingerprint를 포함한 재실행 가능한 발행 흐름이 구현되어 있다.
- **기술적 차별점**: 플러그인 백엔드나 프록시 서버를 운영하지 않는다. 대상 저장소에 검토된 런타임을 고정해 설치하고, 기본값은 수동 발행으로 유지한다.

## 2. 문제와 해결

| 사용자 문제 | 해결 방식 | 사용자 가치 |
| --- | --- | --- |
| 문서의 주장과 실제 구현이 어긋남 | 저장소·실행·사용자 확인·추론·계획을 구분하는 증거 모델 적용 | 확인되지 않은 내용을 완료로 오해할 가능성 감소 |
| Git과 Notion에서 같은 문서를 각각 수정함 | Git Markdown을 원본, Notion을 교체형 읽기 미러로 제한 | 리뷰·이력·복구 경로 단일화 |
| 자동화 설치가 기존 파일을 덮어씀 | 기본 dry run과 전체 충돌 사전 검사 | 기존 워크플로와 문서 보호 |
| 자동 발행이 비밀값이나 잘못된 페이지를 건드림 | canonical branch 제한, 보호 환경, 전체 페이지 preflight, 전용 미러 검증 | 외부 쓰기 전에 실패하도록 경계 강화 |

## 3. 핵심 기능과 결과

| 영역 | 구현 결과 | 저장소 근거 |
| --- | --- | --- |
| 문서 작성 | 한국어·영어 프로젝트 개요/사례 연구 템플릿과 증거 분류 지침 제공 | [SKILL.md](../skills/maintain-project-docs/SKILL.md), [EVIDENCE_MODEL.md](../skills/maintain-project-docs/references/EVIDENCE_MODEL.md) |
| 저장소 설치 | 쓰기 없는 계획을 먼저 출력하고, 충돌이 하나라도 있으면 적용 전에 중단 | [install-project-docs.mjs](../skills/maintain-project-docs/scripts/install-project-docs.mjs) |
| 문서 검증 | 필수 섹션, placeholder, 상대 링크, 로컬 경로, 일반적인 credential 패턴, Git 추적 상태 검사 | [validate-project-docs.mjs](../skills/maintain-project-docs/scripts/validate-project-docs.mjs) |
| Notion 발행 | 모든 대상 페이지를 먼저 읽고, 동일 내용은 건너뛰며, 변경 페이지를 교체한 뒤 fingerprint와 응답을 확인 | [sync-project-docs-to-notion.mjs](../skills/maintain-project-docs/scripts/sync-project-docs-to-notion.mjs) |
| 초기 연결 | loopback 전용 Wizard가 전용 페이지와 GitHub Environment를 구성하고, 선택 시 검증된 Git 객체에서 최초 본문 발행 | [setup-project-docs.mjs](../skills/maintain-project-docs/scripts/setup-project-docs.mjs), [initial-publisher.mjs](../skills/maintain-project-docs/scripts/setup/initial-publisher.mjs) |
| 회귀 방지 | 설치·설정·발행·재시도·인증 복구·초기 발행 경계를 Node 내장 테스트로 검증 | [테스트 모음](../skills/maintain-project-docs/scripts/) |

## 4. 핵심 사용자 흐름

```text
저장소 증거 조사
  → Codex가 개요·상세 Markdown 작성
  → 로컬 검증과 render-only dry run
  → Git 리뷰 및 canonical branch 반영
  → 정책에 맞는 GitHub Actions 실행
  → Notion 전체 페이지 preflight
  → 전용 미러 페이지 교체·검증
```

일반적인 문서 작성은 Notion을 수정하지 않는다. 최초 연결 시 명시적으로 선택한 일회성 발행과, 이후 설정된 GitHub Actions 정책만 외부 쓰기를 수행한다.

## 5. 핵심 기술적 판단

### Git Markdown을 원본으로 고정하고 Notion을 생성 결과로 취급

- **상황**: Git과 Notion을 모두 편집 가능한 원본으로 두면 어느 쪽이 최신인지 판단하기 어렵다.
- **선택**: 리뷰 가능한 Git Markdown만 원본으로 유지하고, Notion에는 전용 페이지의 전체 본문을 교체한다.
- **이유**: 코드와 문서를 같은 revision으로 검토할 수 있고, 변경 이력·승인·복구 경로를 Git에 집중할 수 있다.
- **결과**: Notion 수동 메모와 데이터베이스는 미러 페이지 밖에 두어야 하며, 여러 페이지를 한 번에 원자적으로 갱신할 수 없는 Notion API 제약은 재실행 가능한 idempotent 발행으로 보완한다.

자세한 설계 판단은 [Project Detail](./Project_Detail.md#7-핵심-기술-의사결정)에 정리했다.

## 6. 검증 현황

| 검증 항목 | 상태 | 마지막 확인 | 근거와 경계 |
| --- | --- | --- | --- |
| 배포 구성·단위·통합 테스트 | 통과 | 2026-08-01 | `npm.cmd run check`: 필수 배포 파일 29개 확인, 테스트 45/45 통과, 로컬 Windows |
| Git 공백 오류 검사 | 통과 | 2026-08-01 | `git diff --check`, 로컬 작업 트리 |
| 프로젝트 문서 검사 | 통과 | 2026-08-01 | 스킬의 validator로 신규 문서 2개 검사, 오류 0·경고 0 |
| GitHub Actions 문서 검증 | 통과 | 2026-08-01 | [`project-docs-notion.yml` validate 실행](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657316182) 성공 |
| 실제 Notion 발행 | 통과 | 2026-08-01 | [`main`의 `9c3fefa` 수동 발행](https://github.com/Yeon-sik/notion-project-docs/actions/runs/30657348898)에서 2개 페이지 동기화, 이후 Notion read-back으로 제목·source commit·본문 확인 |
| 실제 GitHub Environment 구성 | 확인 | 2026-08-01 | `notion-production` 보호 환경의 승인자·canonical branch 정책과 필수 secret 이름 확인, 값은 조회·기록하지 않음 |
| universal Plugins Directory 등록 | 미제출 | 2026-08-01 | 공개 GitHub 저장소 배포와 디렉터리 등록을 구분 |

검증 명령과 남은 실환경 공백은 [Project Detail](./Project_Detail.md#10-테스트와-검증-전략)에 기록했다.

## 7. 현재 한계와 다음 단계

- **현재 한계**: 현재 저장소·계정 조합의 수동 발행과 read-back은 확인했지만, Notion은 다중 페이지 원자적 트랜잭션을 제공하지 않으며 Setup Wizard 최초 연결·부분 실패 복구·다른 권한 조합은 아직 실환경 검증하지 않았다.
- **다음 한 단계**: 폐기 가능한 테스트 저장소와 Notion 상위 페이지에서 `Setup Wizard 최초 연결 → 동일 revision 재실행 → 부분 실패 후 수동 복구 발행` E2E를 수행하고 실행 링크와 결과를 고정한다.
- **하지 않는 것**: Notion을 협업 원본으로 만들거나, 사용자 토큰을 플러그인 서버·저장소·브라우저 저장소에 보관하지 않는다.

## 8. 관련 문서

- [Project Detail](./Project_Detail.md): 아키텍처, 불변식, 기술 의사결정, 검증 근거와 남은 위험
- [Architecture](./ARCHITECTURE.md): 컴포넌트 경계와 발행 트랜잭션
- [Beginner Guide](./BEGINNER_GUIDE.ko.md): 설치·연결·운영 흐름
- [Configuration](../skills/maintain-project-docs/references/CONFIGURATION.md): 설정 스키마와 설치 옵션
- [Operations](../skills/maintain-project-docs/references/OPERATIONS.md): 발행·복구 절차
