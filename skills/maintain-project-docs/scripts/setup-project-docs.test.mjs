import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { installRepositoryScaffolding } from "./install-project-docs.mjs";
import { startSetupWizard } from "./setup-project-docs.mjs";
import {
  configureGitHubEnvironment,
  discoverGitHubRepository,
  loginToGitHub,
  storeGitHubEnvironmentSecrets,
} from "./setup/github-provisioner.mjs";
import {
  parseNotionPageId,
  preflightNotionParent,
  provisionNotionMirrorPages,
} from "./setup/notion-provisioner.mjs";
import {
  loadSetupContext,
  provisionProjectDocsSetup,
} from "./setup/project-docs-setup.mjs";
import {
  publishInitialProjectDocuments,
  resolveInitialPublicationSource,
  verifyInitialPublicationSourceStillCurrent,
} from "./setup/initial-publisher.mjs";

function temporaryRepository() {
  const target = mkdtempSync(path.join(tmpdir(), "notion-project-docs-setup-"));
  installRepositoryScaffolding({
    apply: true,
    canonicalBranch: "release/docs",
    environment: "notion-docs-production",
    publicationMode: "manual",
    target,
  });
  return target;
}

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

test("Notion page IDs are extracted from URLs and validated", () => {
  assert.equal(
    parseNotionPageId(
      "https://www.notion.so/Project-00112233445566778899aabbccddeeff?pvs=4",
    ),
    "00112233445566778899aabbccddeeff",
  );
  assert.equal(
    parseNotionPageId("00112233-4455-6677-8899-aabbccddeeff"),
    "00112233445566778899aabbccddeeff",
  );
  assert.throws(() => parseNotionPageId("https://www.notion.so/no-id"), /valid 32-character/);
});

test("Notion provisioning creates pages and reuses them across setup sessions", async () => {
  const token = "notion-token-for-test";
  const parentPageId = "00112233445566778899aabbccddeeff";
  const createdIds = [
    "11111111111111111111111111111111",
    "22222222222222222222222222222222",
  ];
  const requests = [];
  let createIndex = 0;
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const pathname = new URL(url).pathname;
    if (pathname === "/v1/users/me") {
      return jsonResponse({ object: "user", name: "Project Docs Test" });
    }
    if (pathname === `/v1/pages/${parentPageId}`) {
      return jsonResponse({
        object: "page",
        id: parentPageId,
        url: `https://www.notion.so/${parentPageId}`,
      });
    }
    if (pathname === `/v1/blocks/${parentPageId}/children`) {
      return jsonResponse({
        object: "list",
        results: createdIds.slice(0, createIndex).map((pageId, index) => ({
          object: "block",
          id: pageId,
          type: "child_page",
          child_page: {
            title: `[Git Mirror] ${index === 0 ? "Project Intro" : "Project Detail"}`,
          },
        })),
        has_more: false,
        next_cursor: null,
      });
    }
    if (pathname === "/v1/pages" && options.method === "POST") {
      const pageId = createdIds[createIndex];
      createIndex += 1;
      return jsonResponse({
        object: "page",
        id: pageId,
        parent: {
          type: "page_id",
          page_id: "00112233445566778899aabbccddeeff",
        },
        url: `https://www.notion.so/${pageId}`,
      });
    }
    if (createdIds.some((pageId) => pathname === `/v1/pages/${pageId}`)) {
      const pageId = pathname.split("/").at(-1);
      const index = createdIds.indexOf(pageId);
      return jsonResponse({
        object: "page",
        id: pageId,
        parent: {
          type: "page_id",
          page_id: "00112233445566778899aabbccddeeff",
        },
        properties: {
          title: {
            type: "title",
            title: [
              {
                plain_text: `[Git Mirror] ${index === 0 ? "Project Intro" : "Project Detail"}`,
              },
            ],
          },
        },
        url: `https://www.notion.so/${pageId}`,
      });
    }
    if (
      createdIds.some((pageId) => pathname === `/v1/pages/${pageId}/markdown`)
    ) {
      const pageId = pathname.split("/").at(-2);
      return jsonResponse({
        object: "page_markdown",
        id: pageId,
        markdown: "",
        truncated: false,
        unknown_block_ids: [],
      });
    }
    return jsonResponse({ message: "not found" }, { status: 404, statusText: "Not Found" });
  };

  const parent = await preflightNotionParent({
    token,
    parentPage: `https://www.notion.so/Parent-${parentPageId}`,
    fetchImpl,
  });
  const documents = [
    { key: "intro", label: "Project Intro" },
    { key: "detail", label: "Project Detail" },
  ];
  const pageIdsByKey = new Map();
  const first = await provisionNotionMirrorPages({
    token,
    parentPageId: parent.parentPageId,
    documents,
    pageIdsByKey,
    fetchImpl,
  });
  const second = await provisionNotionMirrorPages({
    token,
    parentPageId: parent.parentPageId,
    documents,
    pageIdsByKey,
    fetchImpl,
  });
  const reloadedPageIds = new Map();
  const third = await provisionNotionMirrorPages({
    token,
    parentPageId: parent.parentPageId,
    documents,
    pageIdsByKey: reloadedPageIds,
    fetchImpl,
  });

  assert.equal(first.length, 2);
  assert.equal(second.length, 2);
  assert.equal(third.length, 2);
  assert.equal(createIndex, 2);
  assert.equal(pageIdsByKey.get("intro"), createdIds[0]);
  assert.equal(reloadedPageIds.get("detail"), createdIds[1]);
  assert.ok(
    requests.every((request) => request.options.headers.Authorization === `Bearer ${token}`),
  );
  const createBodies = requests
    .filter((request) => request.options.method === "POST")
    .map((request) => JSON.parse(request.options.body));
  assert.deepEqual(
    createBodies.map((body) => body.parent.page_id),
    [parentPageId, parentPageId],
  );
});

test("Notion provisioning rejects a cached page outside the selected parent", async () => {
  const selectedParentId = "00112233445566778899aabbccddeeff";
  const pageId = "11111111111111111111111111111111";
  const fetchImpl = async () =>
    jsonResponse({
      object: "page",
      id: pageId,
      parent: {
        type: "page_id",
        page_id: "ffffffffffffffffffffffffffffffff",
      },
      properties: {
        title: {
          type: "title",
          title: [{ plain_text: "[Git Mirror] Project Intro" }],
        },
      },
      url: `https://www.notion.so/${pageId}`,
    });

  await assert.rejects(
    provisionNotionMirrorPages({
      token: "notion-token-for-test",
      parentPageId: selectedParentId,
      documents: [{ key: "intro", label: "Project Intro" }],
      pageIdsByKey: new Map([["intro", pageId]]),
      fetchImpl,
    }),
    /not a direct child/,
  );
});

test("Notion provisioning rechecks a cached page title and mirror-only content", async () => {
  const parentPageId = "00112233445566778899aabbccddeeff";
  const pageId = "11111111111111111111111111111111";
  const documents = [{ key: "intro", label: "Project Intro" }];
  const fetchFor = ({ title, markdown }) => async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/markdown")) {
      return jsonResponse({
        object: "page_markdown",
        id: pageId,
        markdown,
        truncated: false,
        unknown_block_ids: [],
      });
    }
    return jsonResponse({
      object: "page",
      id: pageId,
      parent: {
        type: "page_id",
        page_id: parentPageId,
      },
      properties: {
        title: {
          type: "title",
          title: [{ plain_text: title }],
        },
      },
      url: `https://www.notion.so/${pageId}`,
    });
  };
  const provision = (fetchImpl) =>
    provisionNotionMirrorPages({
      token: "notion-token-for-test",
      parentPageId,
      documents,
      pageIdsByKey: new Map([["intro", pageId]]),
      fetchImpl,
    });

  await assert.rejects(
    provision(
      fetchFor({
        title: "[Git Mirror] Renamed",
        markdown: "",
      }),
    ),
    /expected mirror title/,
  );
  await assert.rejects(
    provision(
      fetchFor({
        title: "[Git Mirror] Project Intro",
        markdown: "Manual note",
      }),
    ),
    /non-mirror content/,
  );
});

test("GitHub provisioning restricts the environment and sends secrets only through stdin", async () => {
  const calls = [];
  const run = async (command, args, options = {}) => {
    calls.push({ command, args, input: options.input || "" });
    const joined = args.join(" ");
    if (joined.startsWith("auth status")) return { stdout: "", stderr: "" };
    if (joined.startsWith("repo view")) {
      return {
        stdout: JSON.stringify({
          nameWithOwner: "owner/repository",
          visibility: "PRIVATE",
          url: "https://github.com/owner/repository",
        }),
        stderr: "",
      };
    }
    if (joined === "api user") {
      return { stdout: JSON.stringify({ id: 42, login: "owner" }), stderr: "" };
    }
    if (joined.includes("--method PUT") && joined.includes("/environments/")) {
      return { stdout: JSON.stringify({ name: "notion-docs-production" }), stderr: "" };
    }
    if (
      joined.startsWith("api repos/owner/repository/environments/") &&
      joined.endsWith("/deployment-branch-policies")
    ) {
      return {
        stdout: JSON.stringify({
          branch_policies: [
            { id: 10, name: "main" },
            { id: 11, name: "legacy/*" },
          ],
        }),
        stderr: "",
      };
    }
    if (joined.includes("--method POST") && joined.includes("deployment-branch-policies")) {
      return { stdout: JSON.stringify({ id: 12, name: "release/docs" }), stderr: "" };
    }
    if (joined.includes("/secrets")) {
      return {
        stdout: JSON.stringify({
          secrets: [{ name: "NOTION_TOKEN" }, { name: "NOTION_PAGE_IDS_JSON" }],
        }),
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };

  const repository = await discoverGitHubRepository({ cwd: "C:\\repo", run });
  const environment = await configureGitHubEnvironment({
    cwd: "C:\\repo",
    repository: repository.nameWithOwner,
    environmentName: "notion-docs-production",
    canonicalBranch: "release/docs",
    publicationMode: "manual",
    currentUser: repository.currentUser,
    run,
  });
  const notionToken = "secret-token-value";
  const pageIdsJson = '{"intro":"11111111111111111111111111111111"}';
  await storeGitHubEnvironmentSecrets({
    cwd: "C:\\repo",
    repository: repository.nameWithOwner,
    environmentName: "notion-docs-production",
    notionToken,
    pageIdsJson,
    run,
  });

  const environmentCall = calls.find(
    (call) => call.args.includes("PUT") && call.args.some((arg) => arg.includes("/environments/")),
  );
  const environmentBody = JSON.parse(environmentCall.input);
  assert.deepEqual(environmentBody.reviewers, [{ type: "User", id: 42 }]);
  assert.equal(environment.reviewer, "owner");
  assert.equal(environment.reviewerProtection, "required");
  assert.deepEqual(environmentBody.deployment_branch_policy, {
    protected_branches: false,
    custom_branch_policies: true,
  });
  assert.ok(
    calls.some(
      (call) =>
        call.args.includes("DELETE") &&
        call.args.some((arg) => arg.endsWith("/deployment-branch-policies/10")),
    ),
  );
  assert.ok(
    calls.some(
      (call) =>
        call.args.includes("POST") &&
        call.input.includes('"name":"release/docs"'),
    ),
  );

  const secretCalls = calls.filter((call) => call.args[0] === "secret");
  assert.equal(secretCalls.length, 2);
  assert.ok(secretCalls.every((call) => !call.args.join(" ").includes(notionToken)));
  assert.ok(secretCalls.every((call) => !call.args.join(" ").includes(pageIdsJson)));
  assert.equal(secretCalls[0].input, notionToken);
  assert.equal(secretCalls[1].input, pageIdsJson);
});

test("GitHub login uses the browser device flow without waiting for terminal input", async () => {
  const calls = [];
  const run = async (command, args, options = {}) => {
    calls.push({ command, args, options });
    const joined = args.join(" ");
    if (joined.startsWith("auth login")) return { stdout: "", stderr: "" };
    if (joined.startsWith("auth status")) return { stdout: "", stderr: "" };
    if (joined.startsWith("repo view")) {
      return {
        stdout: JSON.stringify({
          nameWithOwner: "owner/repository",
          visibility: "PRIVATE",
          url: "https://github.com/owner/repository",
        }),
        stderr: "",
      };
    }
    if (joined === "api user") {
      return { stdout: JSON.stringify({ id: 42, login: "owner" }), stderr: "" };
    }
    throw new Error(`Unexpected gh call: ${joined}`);
  };

  const repository = await loginToGitHub({ cwd: "C:\\repo", run });
  const loginCall = calls[0];

  assert.equal(loginCall.command, "gh");
  assert.deepEqual(loginCall.args.slice(0, 2), ["auth", "login"]);
  assert.ok(loginCall.args.includes("--web"));
  assert.ok(loginCall.args.includes("--clipboard"));
  assert.equal(loginCall.options.input, "\n");
  assert.equal(loginCall.options.timeoutMs, 300_000);
  assert.equal(repository.nameWithOwner, "owner/repository");
});

test("GitHub provisioning falls back when the plan rejects required reviewers", async () => {
  const environmentBodies = [];
  const run = async (_command, args, options = {}) => {
    const joined = args.join(" ");
    if (joined.includes("--method PUT") && joined.includes("/environments/")) {
      const body = JSON.parse(options.input);
      environmentBodies.push(body);
      if (Array.isArray(body.reviewers) && body.reviewers.length > 0) {
        throw new Error(
          "gh api failed with exit code 1: Failed to create the environment protection rule. " +
            "Please ensure the billing plan supports the required reviewers protection rule. " +
            "(HTTP 422)",
        );
      }
      return {
        stdout: JSON.stringify({ name: "notion-docs-production" }),
        stderr: "",
      };
    }
    if (
      joined.startsWith("api repos/owner/repository/environments/") &&
      joined.endsWith("/deployment-branch-policies")
    ) {
      return {
        stdout: JSON.stringify({ branch_policies: [] }),
        stderr: "",
      };
    }
    if (joined.includes("--method POST") && joined.includes("deployment-branch-policies")) {
      return { stdout: JSON.stringify({ id: 12, name: "main" }), stderr: "" };
    }
    return { stdout: "", stderr: "" };
  };

  const environment = await configureGitHubEnvironment({
    cwd: "C:\\repo",
    repository: "owner/repository",
    environmentName: "notion-docs-production",
    canonicalBranch: "main",
    publicationMode: "manual",
    currentUser: { id: 42, login: "owner" },
    run,
  });

  assert.equal(environmentBodies.length, 2);
  assert.deepEqual(environmentBodies[0].reviewers, [{ type: "User", id: 42 }]);
  assert.equal("reviewers" in environmentBodies[1], false);
  assert.equal("wait_timer" in environmentBodies[1], false);
  assert.equal("prevent_self_review" in environmentBodies[1], false);
  assert.deepEqual(environmentBodies[1].deployment_branch_policy, {
    protected_branches: false,
    custom_branch_policies: true,
  });
  assert.equal(environment.reviewer, "");
  assert.equal(environment.reviewerProtection, "unsupported-by-plan");
});

test("GitHub provisioning does not hide unrelated environment errors", async () => {
  let putCount = 0;
  const run = async (_command, args) => {
    const joined = args.join(" ");
    if (joined.includes("--method PUT") && joined.includes("/environments/")) {
      putCount += 1;
      throw new Error("gh api failed with exit code 1: Validation failed (HTTP 422)");
    }
    return { stdout: "", stderr: "" };
  };

  await assert.rejects(
    () =>
      configureGitHubEnvironment({
        cwd: "C:\\repo",
        repository: "owner/repository",
        environmentName: "notion-docs-production",
        canonicalBranch: "main",
        publicationMode: "manual",
        currentUser: { id: 42, login: "owner" },
        run,
      }),
    /could not configure the protected environment/,
  );
  assert.equal(putCount, 1);
});

test("Setup context reads the pinned workflow environment", () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });

  assert.equal(context.canonicalBranch, "release/docs");
  assert.equal(context.environmentName, "notion-docs-production");
  assert.equal(context.publicationMode, "manual");
  assert.equal(context.documents.length, 2);
});

test("Setup publishes initial content before storing the reusable GitHub secrets", async () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });
  const parentPageId = "00112233445566778899aabbccddeeff";
  const events = [];
  const createdIds = [
    "11111111111111111111111111111111",
    "22222222222222222222222222222222",
  ];
  let createIndex = 0;
  const run = async (_command, args, options = {}) => {
    const joined = args.join(" ");
    events.push(joined);
    if (joined.startsWith("auth status")) return { stdout: "", stderr: "" };
    if (joined.startsWith("repo view")) {
      return {
        stdout: JSON.stringify({
          nameWithOwner: "owner/repository",
          visibility: "PRIVATE",
          url: "https://github.com/owner/repository",
        }),
        stderr: "",
      };
    }
    if (joined === "api user") {
      return { stdout: JSON.stringify({ id: 42, login: "owner" }), stderr: "" };
    }
    if (joined.includes("--method PUT") && joined.includes("/environments/")) {
      return { stdout: JSON.stringify({ name: context.environmentName }), stderr: "" };
    }
    if (
      joined.startsWith("api repos/owner/repository/environments/") &&
      joined.endsWith("/deployment-branch-policies")
    ) {
      return { stdout: JSON.stringify({ branch_policies: [] }), stderr: "" };
    }
    if (joined.includes("--method POST") && joined.includes("deployment-branch-policies")) {
      return { stdout: JSON.stringify({ id: 12, name: context.canonicalBranch }), stderr: "" };
    }
    if (joined.startsWith("secret set")) {
      assert.ok(options.input);
      return { stdout: "", stderr: "" };
    }
    if (joined.includes("/secrets")) {
      return {
        stdout: JSON.stringify({
          secrets: [{ name: "NOTION_TOKEN" }, { name: "NOTION_PAGE_IDS_JSON" }],
        }),
        stderr: "",
      };
    }
    throw new Error(`Unexpected setup command: ${joined}`);
  };
  const fetchImpl = async (url, options) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/v1/users/me") {
      return jsonResponse({ object: "user", name: "Project Docs Test" });
    }
    if (pathname === "/v1/pages/00112233445566778899aabbccddeeff") {
      return jsonResponse({
        object: "page",
        id: "00112233445566778899aabbccddeeff",
        url: "https://www.notion.so/00112233445566778899aabbccddeeff",
      });
    }
    if (pathname === "/v1/blocks/00112233445566778899aabbccddeeff/children") {
      return jsonResponse({
        object: "list",
        results: [],
        has_more: false,
        next_cursor: null,
      });
    }
    if (pathname === "/v1/pages" && options.method === "POST") {
      const pageId = createdIds[createIndex];
      createIndex += 1;
      return jsonResponse({
        object: "page",
        id: pageId,
        parent: {
          type: "page_id",
          page_id: parentPageId,
        },
        url: `https://www.notion.so/${pageId}`,
      });
    }
    if (createdIds.some((pageId) => pathname === `/v1/pages/${pageId}`)) {
      const pageId = pathname.split("/").at(-1);
      const index = createdIds.indexOf(pageId);
      return jsonResponse({
        object: "page",
        id: pageId,
        parent: {
          type: "page_id",
          page_id: parentPageId,
        },
        properties: {
          title: {
            type: "title",
            title: [
              {
                plain_text: `[Git Mirror] ${context.documents[index].label}`,
              },
            ],
          },
        },
        url: `https://www.notion.so/${pageId}`,
      });
    }
    if (createdIds.some((pageId) => pathname === `/v1/pages/${pageId}/markdown`)) {
      const pageId = pathname.split("/").at(-2);
      return jsonResponse({
        object: "page_markdown",
        id: pageId,
        markdown: "",
        truncated: false,
        unknown_block_ids: [],
      });
    }
    return jsonResponse({ message: "not found" }, { status: 404, statusText: "Not Found" });
  };
  const sourceSha = "f".repeat(40);

  const result = await provisionProjectDocsSetup({
    context,
    notionToken: "setup-token",
    parentPage: "https://www.notion.so/00112233445566778899aabbccddeeff",
    publishInitialContent: true,
    github: { run },
    notion: { fetchImpl },
    initialPublication: {
      resolveSource: async ({ repository }) => {
        events.push("initial-source");
        assert.equal(repository, "owner/repository");
        return {
          sourceSha,
          sourceSnapshot: {
            projectConfig: {},
            sourceMarkdownByPath: new Map(),
          },
          warningCount: 0,
        };
      },
      verifySource: async ({ sourceSha: receivedSha }) => {
        events.push("initial-source-confirmed");
        assert.equal(receivedSha, sourceSha);
      },
      publishDocuments: async ({ pageIdsJson, sourceSha: receivedSha }) => {
        events.push("initial-publish");
        assert.equal(receivedSha, sourceSha);
        assert.deepEqual(Object.keys(JSON.parse(pageIdsJson)), ["overview", "case-study"]);
        return {
          status: "published",
          sourceSha,
          documents: context.documents.map((document) => ({
            label: document.label,
            status: "Synced",
          })),
        };
      },
    },
  });

  assert.equal(result.publication.status, "published");
  assert.equal(result.notion.pages.length, 2);
  assert.ok(events.indexOf("initial-source") < events.indexOf("initial-publish"));
  assert.ok(
    events.indexOf("initial-source-confirmed") < events.indexOf("initial-publish"),
  );
  assert.ok(events.indexOf("initial-publish") < events.findIndex((event) => event.startsWith("secret set")));
});

test("Initial publication accepts only a clean canonical Git source", async () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });
  const sourceSha = "a".repeat(40);
  const calls = [];
  const run = async (command, args) => {
    calls.push({ command, args });
    const joined = args.join(" ");
    if (joined === "rev-parse --show-toplevel") {
      return { stdout: `${target}\n`, stderr: "" };
    }
    if (joined === "branch --show-current") {
      return { stdout: `${context.canonicalBranch}\n`, stderr: "" };
    }
    if (joined.startsWith("status --porcelain=v1")) {
      return { stdout: "", stderr: "" };
    }
    if (joined === "rev-parse HEAD") {
      return { stdout: `${sourceSha}\n`, stderr: "" };
    }
    if (
      command === "gh" &&
      joined === "api repos/owner/repository/commits/release%2Fdocs --jq .sha"
    ) {
      return { stdout: `${sourceSha}\n`, stderr: "" };
    }
    if (command === "git" && args[0] === "show") {
      const sourcePath = args[1].slice(sourceSha.length + 1);
      if (sourcePath === context.configPath) {
        return {
          stdout: readFileSync(path.join(target, context.configPath), "utf8"),
          stderr: "",
        };
      }
      return { stdout: `# ${sourcePath}\n`, stderr: "" };
    }
    throw new Error(`Unexpected command: ${command} ${joined}`);
  };
  const validate = () => ({
    issues: [],
    errorCount: 0,
    warningCount: 1,
  });

  const result = await resolveInitialPublicationSource({
    context,
    repository: "owner/repository",
    run,
    validate,
  });

  assert.equal(result.sourceSha, sourceSha);
  assert.equal(result.sourceSnapshot.sourceMarkdownByPath.size, 2);
  assert.equal(result.warningCount, 1);
  assert.ok(calls.some((call) => call.args[0] === "status"));
});

test("Initial publication rejects a non-canonical or dirty document source", async () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });
  const validate = () => ({
    issues: [],
    errorCount: 0,
    warningCount: 0,
  });
  const localSourceSha = "b".repeat(40);
  const runFor =
    ({ branch, dirty = "", remoteSourceSha = localSourceSha }) =>
    async (command, args) => {
      const joined = args.join(" ");
      if (joined === "rev-parse --show-toplevel") {
        return { stdout: `${target}\n`, stderr: "" };
      }
      if (joined === "branch --show-current") {
        return { stdout: `${branch}\n`, stderr: "" };
      }
      if (joined.startsWith("status --porcelain=v1")) {
        return { stdout: dirty, stderr: "" };
      }
      if (joined === "rev-parse HEAD") {
        return { stdout: `${localSourceSha}\n`, stderr: "" };
      }
      if (command === "gh" && joined.includes("commits/release%2Fdocs")) {
        return { stdout: `${remoteSourceSha}\n`, stderr: "" };
      }
      throw new Error(`Unexpected Git command: ${joined}`);
    };

  await assert.rejects(
    resolveInitialPublicationSource({
      context,
      repository: "owner/repository",
      run: runFor({ branch: "feature/docs" }),
      validate,
    }),
    /checked-out branch/,
  );
  await assert.rejects(
    resolveInitialPublicationSource({
      context,
      repository: "owner/repository",
      run: runFor({
        branch: context.canonicalBranch,
        dirty: " M docs/Project_Overview.md\n",
      }),
      validate,
    }),
    /match the checked-out commit/,
  );
  await assert.rejects(
    resolveInitialPublicationSource({
      context,
      repository: "owner/repository",
      run: runFor({
        branch: context.canonicalBranch,
        remoteSourceSha: "e".repeat(40),
      }),
      validate,
    }),
    /match the current GitHub/,
  );
});

test("Initial publication rechecks the canonical source immediately before writing", async () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });
  const sourceSha = "9".repeat(40);
  const run = async (command, args) => {
    const joined = args.join(" ");
    if (joined === "branch --show-current") {
      return { stdout: `${context.canonicalBranch}\n`, stderr: "" };
    }
    if (joined === "rev-parse HEAD") {
      return { stdout: `${sourceSha}\n`, stderr: "" };
    }
    if (command === "gh" && joined.includes("commits/release%2Fdocs")) {
      return { stdout: `${"8".repeat(40)}\n`, stderr: "" };
    }
    throw new Error(`Unexpected source confirmation command: ${joined}`);
  };

  await assert.rejects(
    verifyInitialPublicationSourceStillCurrent({
      context,
      repository: "owner/repository",
      sourceSha,
      run,
    }),
    /changed during setup/,
  );
});

test("Initial publication reuses the guarded publisher with Git source metadata", async () => {
  const target = temporaryRepository();
  const context = loadSetupContext({ target });
  const sourceSha = "c".repeat(40);
  let received;
  const result = await publishInitialProjectDocuments({
    context,
    notionToken: "setup-token",
    pageIdsJson: '{"overview":"11111111111111111111111111111111"}',
    repository: "owner/repository",
    sourceSha,
    sourceSnapshot: {
      projectConfig: {},
      sourceMarkdownByPath: new Map(),
    },
    publisher: async (input) => {
      received = input;
      return {
        dryRun: false,
        documents: [{ label: "Project Intro", status: "Synced" }],
      };
    },
  });

  assert.equal(received.environment.GITHUB_REPOSITORY, "owner/repository");
  assert.equal(received.environment.GITHUB_SHA, sourceSha);
  assert.equal(received.environment.NOTION_TOKEN, "setup-token");
  assert.equal(received.dryRun, false);
  assert.equal(result.status, "published");
  assert.equal(result.documents.length, 1);
});

test("Loopback wizard enforces origin checks and does not persist the submitted token", async () => {
  const target = temporaryRepository();
  const received = [];
  const setupProvisioner = async (input) => {
    received.push({
      notionToken: input.notionToken,
      publishInitialContent: input.publishInitialContent,
    });
    return {
      environment: { environmentName: input.context.environmentName, reviewer: "owner" },
      github: { nameWithOwner: "owner/repository", url: "", visibility: "PRIVATE" },
      notion: { botName: "bot", parentUrl: "", pages: [] },
      publication: { status: "published", sourceSha: "d".repeat(40), documents: [] },
      secrets: { secretNames: ["NOTION_TOKEN", "NOTION_PAGE_IDS_JSON"] },
    };
  };
  const githubLogin = async () => ({
    currentUser: { id: 42, login: "owner" },
    nameWithOwner: "owner/repository",
    url: "https://github.com/owner/repository",
    visibility: "PRIVATE",
  });
  const wizard = await startSetupWizard({
    target,
    openBrowser: false,
    setupProvisioner,
    githubLogin,
  });
  const origin = new URL(wizard.url).origin;

  try {
    const pageResponse = await fetch(wizard.url);
    const html = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(pageResponse.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(pageResponse.headers.get("cache-control"), "no-store, max-age=0");
    assert.ok(!html.includes("submitted-secret"));
    assert.match(html, /publishInitialContent/);

    const rejected = await fetch(`${wizard.url}setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://attacker.invalid",
      },
      body: JSON.stringify({}),
    });
    assert.equal(rejected.status, 403);

    const oversized = await fetch(`${wizard.url}setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ notionToken: "x".repeat(17_000) }),
    });
    assert.equal(oversized.status, 413);

    const loginResponse = await fetch(`${wizard.url}github-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({}),
    });
    assert.equal(loginResponse.status, 200);
    assert.deepEqual(await loginResponse.json(), {
      login: "owner",
      repository: "owner/repository",
    });

    const accepted = await fetch(`${wizard.url}setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        notionToken: "submitted-secret",
        parentPage: "https://www.notion.so/00112233445566778899aabbccddeeff",
        publishInitialContent: true,
        acknowledgePolicyReplacement: true,
      }),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(received, [
      {
        notionToken: "submitted-secret",
        publishInitialContent: true,
      },
    ]);
  } finally {
    await new Promise((resolve) => wizard.server.close(resolve));
  }
});

test("Loopback wizard clears cached page IDs when the parent page changes", async () => {
  const target = temporaryRepository();
  const observedMapSizes = [];
  let attempt = 0;
  const setupProvisioner = async (input) => {
    observedMapSizes.push(input.pageIdsByKey.size);
    attempt += 1;
    if (attempt === 1) {
      input.pageIdsByKey.set("overview", "11111111111111111111111111111111");
      throw new Error("forced retry");
    }
    return {
      environment: {
        environmentName: input.context.environmentName,
        reviewer: "owner",
        reviewerProtection: "required",
      },
      github: { nameWithOwner: "owner/repository", url: "", visibility: "PRIVATE" },
      notion: { botName: "bot", parentUrl: "", pages: [] },
      publication: { status: "skipped", sourceSha: "", documents: [] },
      secrets: { secretNames: ["NOTION_TOKEN", "NOTION_PAGE_IDS_JSON"] },
    };
  };
  const wizard = await startSetupWizard({
    target,
    openBrowser: false,
    setupProvisioner,
  });
  const origin = new URL(wizard.url).origin;
  const submit = (parentPage) =>
    fetch(`${wizard.url}setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        notionToken: "submitted-secret",
        parentPage,
        publishInitialContent: false,
        acknowledgePolicyReplacement: true,
      }),
    });

  try {
    const first = await submit(
      "https://www.notion.so/00112233445566778899aabbccddeeff",
    );
    assert.equal(first.status, 500);
    const second = await submit(
      "https://www.notion.so/ffeeddccbbaa99887766554433221100",
    );
    assert.equal(second.status, 200);
    assert.deepEqual(observedMapSizes, [0, 0]);
  } finally {
    await new Promise((resolve) => wizard.server.close(resolve));
  }
});
