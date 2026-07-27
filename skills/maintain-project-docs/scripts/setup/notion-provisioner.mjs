const NOTION_API_BASE_URL = "https://api.notion.com";
const NOTION_API_VERSION = "2026-03-11";
const NOTION_PAGE_ID_PATTERN =
  /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi;
const MAX_ATTEMPTS = 4;
const SOURCE_FINGERPRINT_PATTERN = /source sha256\s+`?[0-9a-f]{64}`?/i;

function normalizedPageId(pageId) {
  return pageId.replaceAll("-", "").toLocaleLowerCase();
}

function pageUrl(pageId) {
  return `https://www.notion.so/${normalizedPageId(pageId)}`;
}

function mirrorPageTitle(document) {
  return `[Git Mirror] ${document.label}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function parseNotionPageId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Notion parent page URL is required.");
  }

  const matches = value.trim().match(NOTION_PAGE_ID_PATTERN) ?? [];
  const candidate = matches.at(-1);
  if (!candidate || normalizedPageId(candidate).length !== 32) {
    throw new Error("Notion parent page URL must contain a valid 32-character page ID.");
  }
  return normalizedPageId(candidate);
}

function safeNotionError(response, responseText) {
  let message = "";
  try {
    const parsed = JSON.parse(responseText);
    if (typeof parsed?.message === "string") message = parsed.message;
    else if (typeof parsed?.code === "string") message = parsed.code;
  } catch {
    message = "";
  }

  const detail = message ? `: ${message.slice(0, 500)}` : "";
  return new Error(`Notion API request failed (${response.status} ${response.statusText})${detail}`);
}

export async function notionRequest({
  token,
  pathname,
  method = "GET",
  body,
  fetchImpl = fetch,
}) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Notion integration token is required.");
  }
  if (typeof pathname !== "string" || !pathname.startsWith("/v1/")) {
    throw new Error("Notion API pathname must start with /v1/.");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchImpl(`${NOTION_API_BASE_URL}${pathname}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (response.ok) {
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : {};
    }

    const responseText = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw safeNotionError(response, responseText);
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const waitMilliseconds = Number.isFinite(retryAfterSeconds)
      ? Math.max(250, retryAfterSeconds * 1_000)
      : 250 * 2 ** (attempt - 1);
    await delay(waitMilliseconds);
  }

  throw new Error("Notion API request failed after retries.");
}

export async function preflightNotionParent({
  token,
  parentPage,
  fetchImpl = fetch,
}) {
  const parentPageId = parseNotionPageId(parentPage);
  const [bot, page] = await Promise.all([
    notionRequest({ token, pathname: "/v1/users/me", fetchImpl }),
    notionRequest({ token, pathname: `/v1/pages/${parentPageId}`, fetchImpl }),
  ]);

  if (page?.object !== "page" || page.archived || page.in_trash) {
    throw new Error("The selected Notion parent page is unavailable, archived, or in trash.");
  }

  return {
    botName: bot?.name || bot?.bot?.owner?.user?.name || "Notion connection",
    parentPageId,
    parentUrl: page.url || pageUrl(parentPageId),
  };
}

async function reusableMirrorPages({
  token,
  parentPageId,
  documents,
  fetchImpl,
}) {
  const pagesByTitle = new Map();
  let cursor = "";

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const result = await notionRequest({
      token,
      pathname: `/v1/blocks/${parentPageId}/children?${query}`,
      fetchImpl,
    });
    if (result?.object !== "list" || !Array.isArray(result.results)) {
      throw new Error("Notion returned an invalid parent-page child list.");
    }

    for (const block of result.results) {
      if (
        block?.type !== "child_page" ||
        typeof block.id !== "string" ||
        typeof block.child_page?.title !== "string"
      ) {
        continue;
      }
      const matches = pagesByTitle.get(block.child_page.title) ?? [];
      matches.push(normalizedPageId(block.id));
      pagesByTitle.set(block.child_page.title, matches);
    }

    if (!result.has_more) break;
    if (typeof result.next_cursor !== "string" || !result.next_cursor) {
      throw new Error("Notion child-page pagination is incomplete.");
    }
    cursor = result.next_cursor;
    if (pageNumber === 19) {
      throw new Error("Notion parent page contains too many children to inspect safely.");
    }
  }

  const reusable = new Map();
  for (const document of documents) {
    const title = mirrorPageTitle(document);
    const matches = pagesByTitle.get(title) ?? [];
    if (matches.length > 1) {
      throw new Error(
        `Multiple Notion child pages are named "${title}". Rename or remove duplicates before retrying.`,
      );
    }
    if (matches.length === 0) continue;

    const pageId = matches[0];
    const markdown = await notionRequest({
      token,
      pathname: `/v1/pages/${pageId}/markdown`,
      fetchImpl,
    });
    if (
      markdown?.object !== "page_markdown" ||
      typeof markdown.id !== "string" ||
      normalizedPageId(markdown.id) !== pageId ||
      typeof markdown.markdown !== "string" ||
      markdown.truncated ||
      (markdown.unknown_block_ids?.length ?? 0) > 0
    ) {
      throw new Error(`Existing Notion mirror candidate is incomplete for ${document.label}.`);
    }
    if (markdown.markdown.trim() && !SOURCE_FINGERPRINT_PATTERN.test(markdown.markdown)) {
      throw new Error(
        `Existing Notion page "${title}" contains non-mirror content and will not be reused.`,
      );
    }
    reusable.set(document.key, pageId);
  }
  return reusable;
}

export async function provisionNotionMirrorPages({
  token,
  parentPageId,
  documents,
  pageIdsByKey = new Map(),
  fetchImpl = fetch,
}) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error("At least one configured project document is required.");
  }

  if (documents.some((document) => !pageIdsByKey.has(document.key))) {
    const reusable = await reusableMirrorPages({
      token,
      parentPageId,
      documents,
      fetchImpl,
    });
    for (const [key, pageId] of reusable) {
      if (!pageIdsByKey.has(key)) pageIdsByKey.set(key, pageId);
    }
  }

  for (const document of documents) {
    if (pageIdsByKey.has(document.key)) continue;

    const title = mirrorPageTitle(document);
    const page = await notionRequest({
      token,
      pathname: "/v1/pages",
      method: "POST",
      body: {
        parent: {
          type: "page_id",
          page_id: parentPageId,
        },
        properties: {
          title: {
            type: "title",
            title: [
              {
                type: "text",
                text: {
                  content: title,
                },
              },
            ],
          },
        },
      },
      fetchImpl,
    });

    if (page?.object !== "page" || typeof page.id !== "string") {
      throw new Error(`Notion did not return a page ID for ${document.label}.`);
    }
    pageIdsByKey.set(document.key, normalizedPageId(page.id));
  }

  const verification = await Promise.all(
    documents.map(async (document) => {
      const pageId = pageIdsByKey.get(document.key);
      const page = await notionRequest({
        token,
        pathname: `/v1/pages/${pageId}`,
        fetchImpl,
      });
      if (page?.object !== "page" || page.archived || page.in_trash) {
        throw new Error(`Created Notion page is unavailable for ${document.label}.`);
      }
      return {
        key: document.key,
        label: document.label,
        pageId,
        pageUrl: page.url || pageUrl(pageId),
      };
    }),
  );

  return verification;
}
