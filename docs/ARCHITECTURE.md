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
| Local setup wizard | Provision Notion pages and GitHub environment secrets, with an explicit guarded initial-content publication option |
| Target configuration | Define canonical branch, publication mode, document keys, paths, and required sections |
| GitHub Actions | Validate automatically and publish by the selected manual or canonical-push policy |
| Notion API | Read and replace dedicated mirror page content |

The plugin is intentionally skills-only. It does not host a service or proxy
credentials. The optional setup UI binds only to `127.0.0.1` and closes after
success or timeout. Same-session page mappings stay in memory. After a
successful setup, only the reusable Notion token and most recently used parent
page URL are stored in the current OS user's local configuration directory so
other repositories can reuse them. The browser receives only the recent URL
and a boolean indicating whether a token exists. GitHub Actions talks directly
to Notion during normal publication. When initial publication is
selected, the local wizard uses the same publisher only after confirming a
clean, tracked, validated canonical-branch source. It renders from the verified
Git object snapshot, so a later working-tree edit cannot be mislabeled with the
earlier source commit. Immediately before body publication, it confirms the
checked-out branch, local `HEAD`, and GitHub canonical tip still match that
snapshot.

The setup wizard requires an explicit target repository root. It does not use
the shell's current working directory or the skill source directory as an
implicit fallback. The target must contain the repository-local configuration
and installed workflow before any GitHub or Notion operation can begin.

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
- Setup credentials are not placed in URLs, command arguments, repository
  files, logs, or browser storage.
- The device connection state stores only the reusable token and recent parent
  page URL under the current OS user's local configuration directory. It uses
  owner-only permissions on POSIX and inherited user-profile ACLs on Windows.
- Stored defaults are replaced only after a complete successful setup. A new
  token or page URL can be supplied in any run; omitted values reuse the stored
  defaults.
- No committed tokens or page IDs.
- One-time local initial publication requires an explicit selected option, a
  clean canonical checkout, tracked validated documents, and full destination
  preflight.
- Same-session setup retries bind cached page IDs to the normalized parent and
  integration token. Page verification rejects targets outside that parent,
  renamed pages, incomplete Markdown, and non-mirror content.
- Read-only GitHub token permissions.
- Branch restriction enforced inside the publisher.
- Manual workflow dispatch and exact confirmation string in `manual` mode.
- Explicit `on-main-push` opt-in for automatic canonical-branch publication.
- Protected GitHub environment for secrets and branch policy; human approval
  is enabled only in `manual` mode.
- Full destination preflight before the first write.
- Common secret and local-path checks in publishable Markdown.
