# Notion publication operations

## Contents

1. Notion connection
2. GitHub controls
3. Secrets
4. First publication
5. Failure and recovery

## Notion connection

Create a Notion integration with read-content and update-content capabilities.
Create one parent page dedicated to project-doc mirrors and connect it to the
integration. The setup wizard creates one dedicated child page per configured
document. Do not put manual notes, unrelated child pages, or databases inside
the generated mirror pages.

If the setup wizard cannot be used, create and share each mirror page manually
and record its ID in `NOTION_PAGE_IDS_JSON`.

## GitHub controls

Create the GitHub environment selected during installation and limit deployment
branches to the configured canonical branch.

`publicationMode` controls how a validated canonical revision is published.

- `manual` is the default. Configure a required reviewer when the repository
  and GitHub plan support it. Publication always requires `workflow_dispatch`,
  `operation=publish`, the exact `PUBLISH` confirmation, and the configured
  canonical branch. It additionally requires environment approval when a
  reviewer is configured.
- `on-main-push` is opt-in. Do not configure a required reviewer, because that
  would make every automatic run wait for manual approval. A matching push or
  merge to the configured canonical branch publishes after validation. The
  manual `PUBLISH` path remains available for recovery.

Both modes keep the protected environment for secrets and branch policy. Pull
requests and non-canonical pushes never write to Notion.

The setup wizard configures the installed environment, replaces its deployment
branch policies with the configured canonical branch, and uses the current
GitHub user as the required reviewer in `manual` mode. In `on-main-push` mode,
it removes required reviewers so canonical pushes do not wait for approval.
Review the displayed target before accepting this policy change.

GitHub Free, Pro, and Team plans support required reviewers only for public
repositories. When GitHub returns the specific billing-plan HTTP 422, the
wizard retries without a reviewer and reports the reduced protection on the
completion screen. Do not interpret a successful fallback as an approved
deployment: the exact `PUBLISH` guard remains, but the separate Environment
approval does not. Private repositories still require a plan with Environment
secret support.

## Secrets

Store both values in the protected GitHub environment:

- `NOTION_TOKEN`: the Notion integration token.
- `NOTION_PAGE_IDS_JSON`: a JSON object mapping configured document keys to
  page IDs.

Example:

```json
{"overview":"11111111111111111111111111111111","case-study":"22222222222222222222222222222222"}
```

Never commit either value.

The setup wizard sends both values to `gh secret set` through standard input.
GitHub does not return secret values after storage, so the wizard verifies the
presence of both secret names and the first publication verifies their actual
runtime behavior.

## First publication

1. Review the Notion pages and ensure they contain no manual child content.
2. Merge the complete runtime and documents to the canonical branch.
3. Confirm the validation job passes.
4. For `manual`, dispatch `validate`, then dispatch `publish` and enter
   `PUBLISH`. Approve the environment when a required reviewer is configured.
5. For `on-main-push`, confirm that the merge-triggered publish job completes
   without an approval wait.
6. Review the Actions summary, both Notion pages, source revision links, and
   source fingerprints.

## Failure and recovery

- Preflight failure: grant the integration access or correct the page map, then
  rerun. No write should have occurred.
- Partial publication: do not edit the mirror manually. Rerun the same source
  revision; already-current pages are skipped.
- Truncated or unknown Markdown: reduce unsupported page content or choose a
  clean dedicated mirror page.
- Wrong content: fix the canonical Markdown in Git and publish a reviewed
  revision. Do not repair only the Notion mirror.
- Credential exposure: revoke the token, remove the value from Git history if
  committed, create a new token, and update the protected environment secret.
