# Repository configuration

## Contents

1. Installation
2. Configuration file
3. Installed runtime
4. Upgrade policy

## Installation

Run the installer from the skill directory. It is non-writing by default:

```text
node scripts/install-project-docs.mjs --target <repository>
```

Supported options:

- `--locale en|ko`: choose the template and default document names.
- `--canonical-branch <branch>`: restrict publication to this branch.
- `--publication-mode manual|on-main-push`: choose manual approval or
  canonical-branch automatic publication. The default is `manual`.
- `--environment <name>`: set the protected GitHub environment used by the
  publication job.
- `--apply`: create files after a conflict-free dry run.

The installer never overwrites a differing file. A conflict stops the whole
preflight before any new file is written.

## One-time connection wizard

After the runtime is installed and reviewed, create one Notion parent page and
connect an internal Notion integration to it. From the target repository root,
invoke the installed skill script:

```text
node <skill-directory>/scripts/setup-project-docs.mjs
```

The command opens an ephemeral browser UI on a random `127.0.0.1` port. It
reads the installed configuration and workflow, creates one dedicated Notion
child page per configured document, configures the protected GitHub
environment, and stores `NOTION_TOKEN` plus `NOTION_PAGE_IDS_JSON`.
Use `--target <repository>` only when the current working directory is not the
target repository.

On rerun, it reuses an exact `[Git Mirror] <document label>` child only when
the page is blank or contains a publisher source fingerprint. Duplicate names
or non-mirror content stop setup before that page is reused.

The wizard requires GitHub CLI authentication and repository administration
permission. It does not write credentials or page IDs to the target
repository, command arguments, logs, browser storage, or a hosted service.
Use `--no-open` when the local URL should only be printed.

GitHub Free, Pro, and Team plans expose required reviewers only for public
repositories. If GitHub returns the specific plan-limit HTTP 422 while
configuring a manual-mode reviewer, the wizard retries the Environment without
a reviewer and displays a reduced-protection warning. The exact `PUBLISH`
confirmation and canonical-branch restriction remain in force, but there is no
separate Environment approval. Private repositories must still use a plan that
supports Environment secrets.

## Configuration file

`project-docs.config.json` is the target repository's canonical document map:

```json
{
  "$schema": "./.github/project-docs/project-docs.config.schema.json",
  "version": 1,
  "canonicalBranch": "main",
  "publicationMode": "manual",
  "documents": [
    {
      "key": "overview",
      "label": "Project Overview",
      "path": "docs/Project_Overview.md",
      "requiredSections": ["Executive summary", "Verification"]
    }
  ]
}
```

Rules:

- Keep `publicationMode` as `manual` for reviewed releases, or explicitly set
  `on-main-push` when every matching merge to the canonical branch should
  update Notion.
- Keep document keys unique, stable, lower-case, and hyphen-delimited.
- Keep document paths relative to the repository and Git-tracked.
- Use `requiredSections` for language- or organization-specific structure.
- Map each key to one dedicated Notion page in `NOTION_PAGE_IDS_JSON`.
- Do not store page IDs or tokens in the configuration file.

## Installed runtime

The installer creates:

```text
project-docs.config.json
.github/
  project-docs/
    project-docs.config.schema.json
    project-docs-config.mjs
    sync-project-docs-to-notion.mjs
    validate-project-docs.mjs
  workflows/
    project-docs-notion.yml
docs/
  templates/
    ...
```

The target repository owns this pinned runtime. GitHub Actions never depends on
an agent's local plugin installation.

## Upgrade policy

Run a new plugin version's installer without `--apply`. Differing installed
runtime files appear as conflicts by design. Review the upstream diff, update
the target repository in one change, run validation, and preserve local
configuration deliberately. Do not use a force-overwrite upgrade.
