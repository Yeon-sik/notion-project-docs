# Privacy policy

Effective date: 2026-07-26

Notion Project Docs is a skills-only plugin distributed as source code. The
publisher does not operate a backend service and does not receive, store, or
process users' repository content, Notion content, credentials, or telemetry.

When a user installs repository automation:

- The optional setup wizard processes the Notion token and parent page URL in
  one loopback-only, in-memory session and closes after success or timeout.
- GitHub Actions reads the configured Git-tracked Markdown files.
- The workflow sends rendered Markdown directly from GitHub Actions to the
  Notion API.
- `NOTION_TOKEN` and `NOTION_PAGE_IDS_JSON` remain in the user's protected
  GitHub environment.
- GitHub and Notion process data under the user's agreements with those
  services.

Users control which repository files and dedicated Notion pages participate.
The plugin does not create analytics, advertising identifiers, or external
tracking.

The setup wizard does not place credentials in URLs, command arguments,
repository files, logs, browser storage, or a plugin-operated service.

For privacy questions, open a GitHub issue that contains no private content or
use the contact method listed on the publisher's GitHub profile.
