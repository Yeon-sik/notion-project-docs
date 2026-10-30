# Notion Project Docs | 근거가 남는 프로젝트 문서를 안전하게 Notion까지 연결

저장소의 코드·테스트·설정을 근거로 프로젝트 소개와 기술 사례 문서를 만들고, 검토된 Git Markdown만 전용 Notion 페이지에 미러링하는 Codex 플러그인이다.

| 항목 | 내용 |
| --- | --- |
| 문서 갱신 | 2026-10-30 (Asia/Seoul) |
| 최신 감사 revision | [main@454d245](https://github.com/Yeon-sik/notion-project-docs/tree/454d245f983772473dc74be7016f0674cafecf3b) |
| 구현 기준 | [main@a2371f0](https://github.com/Yeon-sik/notion-project-docs/tree/a2371f08e14630122488e493cfa56a650753d769) — 이후 main 변경은 Intro/Detail 문서 정리뿐 |
| 현재 상태 | v0.2.0 공개 저장소 배포 · universal Plugins Directory 미제출 |
| 주요 기술 | Codex Skills · Node.js ESM · GitHub Actions · Notion API · JSON Schema |
| 저장소 | [Yeon-sik/notion-project-docs](https://github.com/Yeon-sik/notion-project-docs) |

## 1. 30초 요약

- Git Markdown을 canonical source로 유지하고 Notion을 generated read-only mirror로 취급한다.
- Codex skill이 source/test/config/deploy evidence를 분류하고 구현·검증·추론·계획 상태를 섞지 않도록 문서 작성 계약을 제공한다.
- validator가 required section, tracked path, link, secret-like content를 검사하고 publish workflow가 승인된 Intro/Detail만 Notion 전용 페이지에 반영한다.
- `a2371f0..454d245` 비교 결과 제품/플러그인 구현 변화 없이 Intro/Detail 문서만 갱신됐다.

## 2. 핵심 기능과 결과

| 영역 | 현재 source에서 확인한 범위 |
| --- | --- |
| 작성 규칙 | repository-grounded Intro/Detail 구조, evidence class와 explicit source boundary. |
| 검증 | 문서 section·tracked source·link·secret 위험 검사와 render-only dry run. |
| 발행 | GitHub Actions + Notion API를 통한 dedicated mirror replace-only publication. |
| 안전 경계 | Git canonical, Notion generated mirror, source fingerprint와 immutable revision. |
| 배포 형태 | Node.js ESM CLI/스크립트와 Codex skill, GitHub workflow template. |

## 3. 핵심 불변식

- 코드 존재 = runtime verified가 아니다.
- 테스트 존재 = 테스트 통과가 아니다.
- build 성공 = production/실기기 검증 완료가 아니다.
- Git Markdown이 canonical이고 Notion mirror를 두 번째 원본으로 직접 편집하지 않는다.
- publication source SHA와 fingerprint를 명시해 어떤 revision이 게시됐는지 추적 가능해야 한다.
- token·credential·private 원본 데이터는 문서와 mirror에 포함하지 않는다.

## 4. 검증 현황

| 항목 | 상태 | 근거와 한계 |
| --- | --- | --- |
| 최신 main diff | 저장소 검증 | `a2371f0..454d245`은 `docs/Project_Intro.md`, `docs/Project_Detail.md`만 변경됐다. |
| v0.2.0 구현 | 저장소 검증 | skill, Node scripts, schema와 workflow template가 구현 기준 revision에 존재한다. |
| universal Plugins Directory | 미제출 | 공개 GitHub 저장소 상태와 directory 배포는 별도다. |
| 실제 외부 저장소 publication | 프로젝트별 검증 | 각 소비 저장소의 secret/environment/Notion 권한과 workflow 성공 여부를 별도로 확인해야 한다. |

## 5. 현재 한계와 다음 단계

- 자동화가 설치돼 있어도 각 저장소의 canonical docs 품질을 자동으로 보장하지 않는다.
- Notion API/permission 변경과 workflow secret 구성은 소비 저장소별 운영 경계다.
- 다음 우선 작업은 여러 실제 저장소에서 validator→render→publish→read-back 계약을 동일 revision으로 반복 검증하는 것이다.

## 6. 관련 문서

- [프로젝트 상세](./Project_Detail.md)
- [Skill](../skills/maintain-project-docs/SKILL.md)
- [Evidence model](../skills/maintain-project-docs/references/EVIDENCE_MODEL.md)
- [README](../README.md)

Git Markdown이 원본이며 Notion은 생성 미러다.
