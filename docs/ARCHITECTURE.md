# Architecture

## Design goals

1. Keep repository Markdown canonical.
2. Separate agent installation from CI execution.
3. Make the publication policy explicit and every source change reviewable.
4. Keep the installed runtime deterministic and dependency-free.
5. Support multiple document names and languages without code changes.

## Boundaries

| Boundary | Responsibility |
| --- | --- |
| Codex plugin | Discover the workflow and guide evidence-based writing |
| Skill assets | Supply templates, configuration defaults, and workflow source |
| Repository installer | Pin a reviewed runtime into the target repository |
| Target configuration | Define canonical branch, publication mode, document keys, paths, and required sections |
| GitHub Actions | Validate automatically and publish by the selected manual or canonical-push policy |
| Notion API | Read and replace dedicated mirror page content |

The plugin is intentionally skills-only. It does not host a service or proxy
credentials. GitHub Actions talks directly to Notion.

## Installed runtime

The target repository receives a pinned copy of the configuration loader,
validator, publisher, JSON Schema, and workflow. This avoids a hidden runtime
dependency on whichever plugin version an individual developer has installed.

Upgrades are explicit. The installer reports differing runtime files as
conflicts, so maintainers review changes instead of silently overwriting local
policy.

## Publication transaction

1. Load and validate the repository configuration.
2. Validate the token, page map, unique page IDs, and every source file.
3. Render all configured documents.
4. Retrieve every destination page as complete Markdown.
5. Abort without writes if any preflight fails or is incomplete.
6. Skip destinations that already match.
7. Replace remaining dedicated pages.
8. Verify the returned page, source fingerprint, and page identity.
9. Write a GitHub Actions summary and fail visibly on partial publication.

Notion does not provide a multi-page atomic transaction. The rerunnable,
idempotent design is therefore the recovery mechanism for partial network or
service failures.

## Security model

- No plugin-hosted backend or telemetry.
- No committed tokens or page IDs.
- Read-only GitHub token permissions.
- Branch restriction enforced inside the publisher.
- Manual workflow dispatch and exact confirmation string in `manual` mode.
- Explicit `on-main-push` opt-in for automatic canonical-branch publication.
- Protected GitHub environment for secrets and branch policy; human approval
  is enabled only in `manual` mode.
- Full destination preflight before the first write.
- Common secret and local-path checks in publishable Markdown.
