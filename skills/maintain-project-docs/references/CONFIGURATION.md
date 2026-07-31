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
environment, and stores `NOTION_TOKEN` plus `NOTION_PAGE_IDS_JSON`. By default,
the checked **initial content publication** option also fills those pages with
the current configured Markdown during the same connection.
Use `--target <repository>` only when the current working directory is not the
target repository.

On the first successful setup, enter both the Notion integration token and
connected parent page URL. The wizard stores that token and the most recently
successful parent URL in the current OS user's local configuration directory:

- Windows: `%LOCALAPPDATA%\notion-project-docs\connection-state.json`
- macOS: `~/Library/Application Support/notion-project-docs/connection-state.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/notion-project-docs/connection-state.json`

Later runs in any repository reuse the stored token when the token field is
empty. Entering a new token replaces it only after the complete setup succeeds.
The recent parent URL is visible and editable on every run; clearing it reuses
the last successful URL. The browser receives the recent URL and only a boolean
indicating whether a token exists, never the stored token itself. Delete the
state file to clear these local defaults. This does not remove or rotate any
GitHub Environment secret.

Initial content publication uses the same full-page preflight, replacement,
source-fingerprint, and response checks as the GitHub publisher. It reads the
published Markdown from the verified Git commit rather than rereading mutable
working-tree files and rechecks local `HEAD` plus the GitHub canonical tip
immediately before the first body write. To keep Git Markdown canonical, it
stops before setup writes when:

- the target is not the Git repository root;
- the checked-out branch is not `canonicalBranch`;
- local `HEAD` does not match the current GitHub canonical-branch tip;
- the configuration or a configured document is untracked or differs from
  `HEAD`; or
- document validation reports an error.

Clear the option to configure pages and secrets without publishing a body.
After the one-time initial publication, every update follows `publicationMode`
through GitHub Actions.

On rerun, it reuses an exact `[Git Mirror] <document label>` child only when
the page is blank or contains a publisher source fingerprint. Duplicate names
or non-mirror content stop setup before that page is reused. Same-session page
IDs are retained only while the normalized parent page and integration token
remain unchanged. Every retained page must still be a direct child of the
selected parent, keep the exact mirror title, and remain blank or contain a
publisher source fingerprint.

The wizard requires GitHub CLI authentication and repository administration
permission. It does not write credentials or page IDs to the target
repository, command arguments, logs, browser storage, or a hosted service. The
device connection state contains only the reusable token and recent parent
URL. It uses owner-only permissions on POSIX and inherits the current user's
local profile ACLs on Windows.
Use `--no-open` when the local URL should only be printed.

If authentication is missing or expired, **GitHub login/refresh** runs
`gh auth login --hostname github.com --web --clipboard`, submits the CLI's
browser prompt, and waits up to five minutes. The one-time code is copied to
the clipboard. If no browser opens, visit `https://github.com/login/device`
manually and paste that code.

GitHub Free, Pro, and Team plans expose required reviewers only for public
repositories. If GitHub returns the specific plan-limit HTTP 422 while
configuring a manual-mode reviewer, the wizard retries the Environment without
a reviewer. The fallback request omits `reviewers`, `wait_timer`, and
`prevent_self_review` entirely and keeps only the deployment branch policy.
The wizard displays a reduced-protection warning. The exact `PUBLISH`
confirmation and canonical-branch restriction remain in force, but there is
no separate Environment approval. Private repositories must still use a plan
that supports Environment secrets.

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
