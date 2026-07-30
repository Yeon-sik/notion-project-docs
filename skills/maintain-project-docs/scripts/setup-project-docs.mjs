#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loginToGitHub } from "./setup/github-provisioner.mjs";
import { parseNotionPageId } from "./setup/notion-provisioner.mjs";
import {
  loadSetupContext,
  provisionProjectDocsSetup,
} from "./setup/project-docs-setup.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.resolve(SCRIPT_DIRECTORY, "../assets/setup-project-docs.html");
const MAX_BODY_BYTES = 16 * 1024;
const SESSION_TIMEOUT_MILLISECONDS = 15 * 60 * 1_000;

function parseArguments(argv) {
  const options = {
    configPath: "project-docs.config.json",
    openBrowser: true,
    target: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") {
      options.target = argv[index + 1];
      if (!options.target) throw new Error("--target requires a path.");
      index += 1;
    } else if (argument === "--config") {
      options.configPath = argv[index + 1];
      if (!options.configPath) throw new Error("--config requires a path.");
      index += 1;
    } else if (argument === "--no-open") {
      options.openBrowser = false;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node setup-project-docs.mjs [options]

Options:
  --target <path>  Target repository (default: current working directory)
  --config <path>  Configuration path inside the target repository
  --no-open        Print the local URL without opening a browser
  -h, --help       Show this help`);
}

function jsonForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function renderHtml(context, cspNonce) {
  const source = readFileSync(HTML_PATH, "utf8");
  const nonceOccurrences = source.split("__CSP_NONCE__").length - 1;
  if (nonceOccurrences !== 2) {
    throw new Error("Setup UI template must contain exactly two __CSP_NONCE__ tokens.");
  }
  if (source.split("__BOOTSTRAP_JSON__").length !== 2) {
    throw new Error("Setup UI template must contain exactly one __BOOTSTRAP_JSON__ token.");
  }
  const bootstrap = jsonForInlineScript({
    canonicalBranch: context.canonicalBranch,
    documents: context.documents,
    environmentName: context.environmentName,
    publicationMode: context.publicationMode,
    target: context.rootDirectory,
  });
  return source
    .replaceAll("__CSP_NONCE__", cspNonce)
    .replace("__BOOTSTRAP_JSON__", bootstrap);
}

function securityHeaders({ cspNonce, contentType }) {
  const headers = {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  if (cspNonce) {
    headers["Content-Security-Policy"] =
      `default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; ` +
      `connect-src 'self'; img-src 'self'; style-src 'nonce-${cspNonce}'; ` +
      `script-src 'nonce-${cspNonce}'`;
  }
  return headers;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(
    statusCode,
    securityHeaders({
      contentType: "application/json; charset=utf-8",
    }),
  );
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      if (tooLarge) return;
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function openLocalBrowser(url) {
  let command;
  let args;
  if (process.platform === "win32") {
    command = "cmd.exe";
    args = ["/d", "/s", "/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => {});
  child.unref();
}

export async function startSetupWizard({
  target = process.cwd(),
  configPath = "project-docs.config.json",
  openBrowser = true,
  setupProvisioner = provisionProjectDocsSetup,
  githubLogin = loginToGitHub,
} = {}) {
  const context = loadSetupContext({ target, configPath });
  const sessionToken = randomBytes(24).toString("base64url");
  const cspNonce = randomBytes(18).toString("base64");
  const sessionPath = `/session/${sessionToken}/`;
  const html = renderHtml(context, cspNonce);
  const pageIdsByKey = new Map();
  let pageBinding = "";
  let busy = false;
  let expectedOrigin = "";
  let shutdownTimer;

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", expectedOrigin || "http://127.0.0.1");
    if (request.method === "GET" && requestUrl.pathname === sessionPath) {
      response.writeHead(
        200,
        securityHeaders({
          cspNonce,
          contentType: "text/html; charset=utf-8",
        }),
      );
      response.end(html);
      return;
    }

    if (
      request.method !== "POST" ||
      ![`${sessionPath}setup`, `${sessionPath}github-login`].includes(requestUrl.pathname)
    ) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    if (
      request.headers.origin !== expectedOrigin ||
      request.headers["content-type"]?.split(";")[0].trim() !== "application/json"
    ) {
      sendJson(response, 403, { error: "Request origin or content type is invalid." });
      return;
    }
    if (busy) {
      sendJson(response, 409, { error: "Another setup operation is already running." });
      return;
    }

    busy = true;
    let payload = {};
    try {
      payload = await readJsonBody(request);
      if (requestUrl.pathname === `${sessionPath}github-login`) {
        const repository = await githubLogin({ cwd: context.rootDirectory });
        sendJson(response, 200, {
          login: repository.currentUser.login,
          repository: repository.nameWithOwner,
        });
        return;
      }

      const notionToken =
        typeof payload.notionToken === "string" ? payload.notionToken.trim() : "";
      const parentPage =
        typeof payload.parentPage === "string" ? payload.parentPage.trim() : "";
      const publishInitialContent = payload.publishInitialContent === true;
      if (!notionToken || notionToken.length > 512) {
        throw Object.assign(new Error("Notion integration token is required."), {
          statusCode: 400,
        });
      }
      if (!parentPage || parentPage.length > 2_048) {
        throw Object.assign(new Error("Notion parent page URL is required."), {
          statusCode: 400,
        });
      }
      if (payload.acknowledgePolicyReplacement !== true) {
        throw Object.assign(
          new Error("GitHub Environment 정책 변경 확인이 필요합니다."),
          { statusCode: 400 },
        );
      }

      const nextPageBinding = createHash("sha256")
        .update(notionToken)
        .update(":")
        .update(parseNotionPageId(parentPage))
        .digest("hex");
      if (pageBinding && pageBinding !== nextPageBinding) {
        pageIdsByKey.clear();
      }
      pageBinding = nextPageBinding;

      const result = await setupProvisioner({
        context,
        notionToken,
        parentPage,
        publishInitialContent,
        pageIdsByKey,
      });
      sendJson(response, 200, result);
      shutdownTimer = setTimeout(() => server.close(), 3_000);
      shutdownTimer.unref();
    } catch (error) {
      const createdCount = pageIdsByKey.size;
      const recovery =
        createdCount > 0
          ? ` ${createdCount}개의 페이지는 이 세션에서 기억하고 있으므로 같은 창에서 다시 시도하세요.`
          : "";
      sendJson(response, error.statusCode || 500, {
        error: `${error instanceof Error ? error.message : String(error)}${recovery}`,
      });
    } finally {
      if (payload && typeof payload === "object") payload.notionToken = "";
      busy = false;
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Cannot determine the local setup server address.");
  }
  expectedOrigin = `http://127.0.0.1:${address.port}`;
  const url = `${expectedOrigin}${sessionPath}`;
  const sessionTimeout = setTimeout(() => server.close(), SESSION_TIMEOUT_MILLISECONDS);
  sessionTimeout.unref();
  server.on("close", () => {
    clearTimeout(sessionTimeout);
    if (shutdownTimer) clearTimeout(shutdownTimer);
    pageIdsByKey.clear();
    pageBinding = "";
  });

  if (openBrowser) openLocalBrowser(url);
  return { context, server, url };
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      const { url } = await startSetupWizard(options);
      console.log(`Local setup wizard: ${url}`);
      console.log("The server closes after setup succeeds or after 15 minutes.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
