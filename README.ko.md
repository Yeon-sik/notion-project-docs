# Notion Project Docs

저장소의 구현·테스트 근거를 프로젝트 문서로 정리하고, 검토가 끝난 Git
Markdown만 전용 Notion 페이지에 미러링하는 Codex 스킬 플러그인입니다.

> 현재 상태: 독립 저장소에 올리기 전의 릴리스 후보입니다. GitHub 푸시와
> 공개 Plugins Directory 제출은 아직 수행하지 않았습니다.

[English](./README.md)

## 핵심 목적

- 포트폴리오용 프로젝트 소개와 기술 사례 문서를 근거 기반으로 작성
- 코드·테스트·배포 기록과 문서 주장 사이의 불일치 방지
- Git Markdown을 진실 원천으로 유지
- Notion을 수동 편집 원본이 아닌 승인된 읽기용 미러로 사용
- 여러 프로젝트와 문서 이름을 JSON 설정으로 재사용

## 안전한 공개 흐름

기본값인 `manual`에서는 pull request와 일반 push가 문서 검증과 렌더링만
실행합니다. Notion 쓰기는 다음 조건이 모두 만족될 때만 가능합니다.

1. 사용자가 GitHub Actions의 수동 실행을 시작합니다.
2. 작업을 `publish`로 선택합니다.
3. 확인란에 정확히 `PUBLISH`를 입력합니다.
4. 보호된 GitHub Environment의 승인을 통과합니다.
5. 실행 브랜치가 설정된 기준 브랜치와 일치합니다.
6. 모든 Notion 대상 페이지의 읽기 사전 점검이 성공합니다.

저장소 소유자가 `publicationMode`를 `on-main-push`로 명시하면, pull
request에서는 계속 검증만 수행하고 기준 브랜치에 병합된 문서 변경은
자동으로 Notion에 발행됩니다. 이 모드에서도 Environment Secret,
기준 브랜치 제한, 전체 페이지 사전 점검과 멱등성 검사는 유지합니다.

## 대상 저장소에 적용

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

이후 `$maintain-project-docs`로 설정된 문서를 작성하고, 다음 GitHub
Environment Secret을 구성합니다.

- `NOTION_TOKEN`: Notion integration token
- `NOTION_PAGE_IDS_JSON`: 문서 키와 전용 Notion 페이지 ID의 JSON 매핑

예:

```json
{"intro":"11111111111111111111111111111111","detail":"22222222222222222222222222222222"}
```

`manual` 모드는 Environment required reviewer를 사용합니다.
`on-main-push` 모드는 자동 발행을 위해 required reviewer를 두지 않고
배포 브랜치를 `main`으로 제한합니다. 수동 `PUBLISH` 실행은 복구 경로로
계속 사용할 수 있습니다.

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
