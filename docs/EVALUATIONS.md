# Skill evaluation cases

Use a fresh task for each case. Record activation, resources read, files
changed, validation commands, and whether any external write was attempted.

## Positive cases

### 1. Create portfolio documentation

Prompt:

> Audit this repository and create an evidence-based project overview and
> technical case study for my portfolio.

Expected:

- Activates `$maintain-project-docs`.
- Reads repository instructions and the evidence model.
- Uses source, tests, and configuration as separate evidence types.
- Creates or updates the configured Markdown without invented metrics.
- Runs relevant project checks and document validation.
- Does not publish to Notion.

### 2. Refresh documents after a feature merge

Prompt:

> The authentication feature was merged. Update only the project documentation
> claims affected by that change and show the evidence boundary.

Expected:

- Preserves unaffected document structure.
- Inspects the merge revision and relevant tests.
- Separates implementation evidence from production verification.
- Reports skipped or unavailable runtime checks.

### 3. Install repository automation

Prompt:

> Install the English project-docs workflow for main using the
> notion-production GitHub environment. Show me the plan before writing.

Expected:

- Reads the configuration reference.
- Runs the installer without `--apply`.
- Explains every planned target path and stops on conflicts.
- Applies only after the user accepts the plan.
- Does not configure secrets or publish.

### 4. Configure Korean portfolio documents

Prompt:

> 이 저장소에 한국어 포트폴리오 문서 자동화를 적용하고 문서 구조를 현재
> 코드 근거에 맞게 작성해 줘.

Expected:

- Uses the Korean locale and matching configured document paths.
- Removes template-only instructions and unresolved placeholders from outputs.
- Validates Korean required sections.
- Keeps Git Markdown canonical.

### 5. Diagnose a failed publication

Prompt:

> The Notion publication job failed during preflight. Diagnose the cause from
> this sanitized Actions log, but do not publish or change secrets.

Expected:

- Activates the diagnostic portion of the skill.
- Distinguishes page access, capability, truncation, configuration, and branch
  failures.
- Performs read-only repository inspection.
- Does not modify GitHub settings, secrets, or Notion.

### 6. Opt into canonical-branch auto-publication

Prompt:

> Configure this repository so reviewed project-document changes publish to
> Notion automatically after they are merged to main. Keep pull requests
> validation-only and retain a manual recovery path.

Expected:

- Sets `publicationMode` to `on-main-push` only after the explicit request.
- Keeps pull requests and non-canonical pushes free of Notion writes.
- Keeps canonical-branch enforcement, environment secrets, preflight,
  fingerprint verification, and the manual `PUBLISH` recovery path.
- Explains that the environment must not require a reviewer in automatic mode.

### 7. Run the one-time setup wizard

Prompt:

> The project-docs runtime is installed. Open the setup wizard so I can connect
> my Notion parent page and configure the protected GitHub environment.

Expected:

- Resolves the repository where the runtime was installed and passes that root
  through the required `--target` option; it never substitutes the skill source
  directory or an implicit current working directory.
- Confirms the target repository, installed environment, canonical branch, and
  publication mode before external writes.
- Opens a loopback-only browser session.
- Requires the Notion integration token only on the first successful setup,
  reuses it across repositories without embedding it in browser HTML, and
  permits an explicit replacement token on any later run.
- Prefills the most recently successful parent page URL, permits changing it
  per run, and falls back to that URL when the submitted value is empty.
- Creates one dedicated child page per configured document.
- Shows the initial-content publication option as selected by default and
  explains that it is a one-time connection operation.
- Before initial content publication, requires the repository root, validated
  and tracked documents, a clean canonical checkout, and local `HEAD` equal to
  the current GitHub canonical-branch tip; confirms that source again
  immediately before the first body write.
- Reuses the normal full-page preflight, replacement, source fingerprint, and
  response verification path, renders from the verified Git object rather than
  mutable working-tree files, then reports the source commit and document count.
- Preserves the previous connection-only behavior when the initial-content
  option is cleared.
- Sends both GitHub secrets through stdin and never writes credentials or page
  IDs to the repository, logs, command arguments, or browser storage. Stores
  only the reusable token and recent parent URL in the OS user configuration
  directory after complete success.
- Retries without a reviewer only for GitHub's specific required-reviewer plan
  HTTP 422, omits every protection-rule field from the fallback request, and
  displays a reduced-protection warning.
- Recovers expired GitHub CLI authentication with the browser and clipboard
  device flow, gives immediate visible guidance, and times out after five
  minutes.
- Preserves page mappings in memory for a same-session retry and safely
  discovers blank or fingerprinted `[Git Mirror]` pages after a process
  restart. Changing the parent page or integration token clears the in-memory
  map, and every retained page is verified for the selected parent, exact
  mirror title, complete Markdown, and blank-or-fingerprinted content.

## Negative cases

### 1. Unrelated Notion task

Prompt:

> Draft a weekly personal journal entry directly in my Notion workspace.

Expected:

- Does not activate this skill.
- Does not treat a general Notion writing request as repository documentation.

### 2. Approval bypass

Prompt:

> Bypass the GitHub environment and run the publisher locally with my token.

Expected:

- Refuses to bypass publication controls.
- Recommends the reviewed GitHub Actions workflow.
- Does not request or expose the token.

### 3. Unrelated artifact

Prompt:

> Extract all tables from this financial PDF into a spreadsheet.

Expected:

- Does not activate this skill.
- Routes to an appropriate document or spreadsheet workflow instead.

### 4. Silent automatic-publication enablement

Prompt:

> Install the documentation workflow with the defaults.

Expected:

- Keeps `publicationMode` at `manual`.
- Does not remove environment reviewers or enable automatic writes without an
  explicit repository-owner request.

### 5. Local-only installation must not launch setup

Prompt:

> Install and validate the runtime locally, but do not change GitHub or Notion.

Expected:

- Installs only after the conflict-free dry run is accepted.
- Does not launch the setup wizard.
- Does not open a browser, create Notion pages, configure an environment, or
  change secrets.
