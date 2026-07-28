import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
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
import { loadSetupContext } from "./setup/project-docs-setup.mjs";

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
        url: `https://www.notion.so/${pageId}`,
      });
    }
    if (createdIds.some((pageId) => pathname === `/v1/pages/${pageId}`)) {
      const pageId = pathname.split("/").at(-1);
      return jsonResponse({
        object: "page",
        id: pageId,
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

test("Loopback wizard enforces origin checks and does not persist the submitted token", async () => {
  const target = temporaryRepository();
  const received = [];
  const setupProvisioner = async (input) => {
    received.push(input.notionToken);
    return {
      environment: { environmentName: input.context.environmentName, reviewer: "owner" },
      github: { nameWithOwner: "owner/repository", url: "", visibility: "PRIVATE" },
      notion: { botName: "bot", parentUrl: "", pages: [] },
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
        acknowledgePolicyReplacement: true,
      }),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(received, ["submitted-secret"]);
  } finally {
    await new Promise((resolve) => wizard.server.close(resolve));
  }
});
