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

- The plugin itself has no hosted service and stores no credentials.
- Target repositories keep `NOTION_TOKEN` and `NOTION_PAGE_IDS_JSON` in a
  protected GitHub environment.
- The generated workflow grants only `contents: read`.
- Notion writes require a manual dispatch, an exact confirmation value, the
  configured canonical branch, and the protected environment.
- The publisher preflights every destination before the first write.
