# Security policy

## Supported versions

Security fixes are applied to the latest release candidate and the latest
published version.

## Report a vulnerability

Do not open a public issue for credential exposure or a vulnerability that
could cause unauthorized Notion writes. Use GitHub private vulnerability
reporting for this repository. Include the affected revision, reproduction
steps, impact, and any proposed mitigation.

Do not include live Notion tokens, page IDs, private document content, or
personal data in a report.

## Security boundaries

- The plugin has no hosted service. After successful setup, the wizard stores
  the reusable Notion token and recent parent page URL in the current OS
  user's local configuration directory, never in a target repository.
- The optional setup server binds to `127.0.0.1`, uses an unguessable session
  path and strict origin/CSP controls, never sends the stored token to the
  browser, and erases in-memory page mappings when the session closes.
- Setup secrets are passed to GitHub CLI through standard input, never command
  arguments or temporary files.
- Target repositories keep `NOTION_TOKEN` and `NOTION_PAGE_IDS_JSON` in a
  protected GitHub environment.
- The generated workflow grants only `contents: read`.
- Notion writes require a manual dispatch, an exact confirmation value, the
  configured canonical branch, and the protected environment.
- The publisher preflights every destination before the first write.
