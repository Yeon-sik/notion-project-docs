# Notion Project Docs | Project Detail

2026-10-30 (Asia/Seoul) 갱신. 최신 감사 revision은 [main@454d245](https://github.com/Yeon-sik/notion-project-docs/tree/454d245f983772473dc74be7016f0674cafecf3b), 구현 기준은 [main@a2371f0](https://github.com/Yeon-sik/notion-project-docs/tree/a2371f08e14630122488e493cfa56a650753d769)이다. 두 revision 사이에는 Intro/Detail 문서 변경만 존재한다.

## 1. 문서 목적과 범위

이 프로젝트는 저장소 근거에서 검토 가능한 Project Intro/Detail을 만들고, Git Markdown을 canonical source로 유지한 채 승인된 문서를 Notion 전용 mirror에 게시하는 Codex plugin/automation이다.

문서화는 코드·테스트·설정·배포·기존 문서를 근거로 하며 OBSERVED/VERIFIED 성격이 다른 증거를 섞지 않는다. source revision과 publication fingerprint를 명시하고 Notion을 수동 편집되는 두 번째 원본으로 만들지 않는다.

## 2. 시스템 아키텍처

```text
Repository source / tests / config / deploy docs
  -> maintain-project-docs skill
     -> evidence classification / source boundary
     -> docs/Project_Intro.md + docs/Project_Detail.md
  -> validate-project-docs.mjs
     -> required sections / tracked paths / links / secret-like content
  -> sync-project-docs-to-notion.mjs
     -> render-only or publish
  -> GitHub Actions / notion-production environment
  -> dedicated Notion mirror pages
```

## 3. 데이터 모델과 불변식

- Git Markdown이 canonical source다. Notion mirror를 별도 원본처럼 직접 편집하지 않는다.
- source revision은 immutable SHA로 고정한다. 현재 branch name만으로 구현 근거를 설명하지 않는다.
- 코드/테스트 파일 존재를 실행 성공으로 표현하지 않는다.
- 과거 CI 성공을 현재 HEAD 성공으로 자동 승격하지 않는다.
- runtime verified, repository verified, user-confirmed, inference, planned를 같은 상태처럼 섞지 않는다.
- publish는 configured Intro/Detail mirror만 대상으로 하며 private raw data와 credential을 포함하지 않는다.
- 동일 source SHA/fingerprint의 publication은 idempotent하게 다룬다.

## 4. 핵심 기술 의사결정

### 결정 1. Git canonical / Notion generated mirror
reviewable history와 실제 source revision을 유지하기 위해 문서 원본을 Git에 둔다.

### 결정 2. Evidence model을 작성 규칙으로 고정
문서 표현을 자유 서술에 맡기지 않고 어떤 주장이 어떤 검증 수준인지 명시하도록 한다.

### 결정 3. Validate와 publish 분리
render-only/validation을 먼저 수행하고 실제 Notion write는 명시된 workflow/permission 경계에서만 수행한다.

### 결정 4. 저장소별 운영 경계 유지
plugin 자체가 설치돼 있어도 각 repository의 branch, secret, page mapping, source SHA와 publication 성공을 개별 검증한다.

## 5. 테스트와 검증 전략

| 검사 | 결과 | 근거·환경과 한계 |
| --- | --- | --- |
| 최신 main diff | 저장소 검증 | `a2371f0..454d245`은 Intro/Detail 문서 변경뿐이며 구현 source 차이는 없다. |
| plugin source | 저장소 검증 | skill, evidence model, validator, sync script, schema와 workflow template를 구현 기준 revision에서 확인했다. |
| 실제 publish | 소비 저장소별 | Notion secret/environment/page mapping과 Actions 결과는 각 저장소의 별도 운영 증거가 필요하다. |
| universal directory | 미제출 | GitHub 공개 저장소와 universal Plugins Directory 배포 상태를 구분한다. |

validator/render-only 성공은 제품 runtime이나 Notion publish 성공을 대신하지 않는다.

## 6. 배포·운영·복구

- Node.js와 GitHub Actions 환경에서 repository-local config를 읽어 검증·render/publish한다.
- publish 실패 시 Git canonical 문서는 그대로 보존되며 같은 source revision/fingerprint로 재실행해 수렴시킨다.
- Notion page mapping과 token은 repository secret/environment에서 관리하고 Git에 넣지 않는다.
- mirror page에 수동 원본 데이터를 섞지 않아 replace-only publication이 사용자 작성 원본을 삭제하지 않게 한다.

**문서 발행**: 이 프로젝트 자체와 소비 프로젝트 모두 Git Markdown→validation→Notion mirror 경계를 유지한다.

## 7. 한계, 기술 부채, 다음 단계

- 자동 validator는 문장의 기술적 진실성 전체를 증명하지 않는다. source audit가 여전히 필요하다.
- Notion API·GitHub Actions 권한 변화는 plugin source와 별도 운영 위험이다.
- 다음 우선 작업은 다양한 실제 repository에서 동일한 revision을 기준으로 validate→render→publish→read-back을 반복 검증하는 것이다.

## 8. 근거와 관련 문서

- [최신 감사 revision](https://github.com/Yeon-sik/notion-project-docs/tree/454d245f983772473dc74be7016f0674cafecf3b)
- [구현 기준 revision](https://github.com/Yeon-sik/notion-project-docs/tree/a2371f08e14630122488e493cfa56a650753d769)
- [Project Intro](./Project_Intro.md)
- [Skill](../skills/maintain-project-docs/SKILL.md)
- [Evidence model](../skills/maintain-project-docs/references/EVIDENCE_MODEL.md)
- [README](../README.md)
