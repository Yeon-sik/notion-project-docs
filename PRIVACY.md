# Privacy policy

Effective date: 2026-08-01

Notion Project Docs is a skills-only plugin distributed as source code. The
publisher does not operate a backend service and does not receive, store, or
process users' repository content, Notion content, credentials, or telemetry
on a publisher-operated service.

When a user installs repository automation:

- After a successful setup, the optional setup wizard stores the Notion token
  and most recently used parent page URL in the current operating-system
  user's local configuration directory. This device connection state is used
  across repositories and can be replaced by entering a new token or page URL.
- The loopback-only browser session receives only a stored-token availability
  flag and the recent parent page URL. It never receives the stored token.
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
repository files, logs, browser storage, or a plugin-operated service. The
device connection state is stored under the user's OS profile, uses owner-only
file permissions on POSIX systems, and inherits the user's local profile ACLs
on Windows. Deleting `connection-state.json` clears the local defaults; the
GitHub Environment secrets must be rotated separately.

For privacy questions, open a GitHub issue that contains no private content or
use the contact method listed on the publisher's GitHub profile.
