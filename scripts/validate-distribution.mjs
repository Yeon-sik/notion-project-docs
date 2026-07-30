#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  ".codex-plugin/plugin.json",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "README.ko.md",
  "SECURITY.md",
  "SUPPORT.md",
  "TERMS.md",
  "assets/icon.svg",
  "assets/logo.svg",
  "docs/ARCHITECTURE.md",
  "docs/EVALUATIONS.md",
  "docs/RELEASE_CHECKLIST.md",
  "skills/maintain-project-docs/SKILL.md",
  "skills/maintain-project-docs/agents/openai.yaml",
  "skills/maintain-project-docs/assets/setup-project-docs.html",
  "skills/maintain-project-docs/references/CONFIGURATION.md",
  "skills/maintain-project-docs/references/EVIDENCE_MODEL.md",
  "skills/maintain-project-docs/references/OPERATIONS.md",
  "skills/maintain-project-docs/scripts/install-project-docs.mjs",
  "skills/maintain-project-docs/scripts/project-docs-config.mjs",
  "skills/maintain-project-docs/scripts/setup/github-provisioner.mjs",
  "skills/maintain-project-docs/scripts/setup/initial-publisher.mjs",
  "skills/maintain-project-docs/scripts/setup/notion-provisioner.mjs",
  "skills/maintain-project-docs/scripts/setup/project-docs-setup.mjs",
  "skills/maintain-project-docs/scripts/setup-project-docs.mjs",
  "skills/maintain-project-docs/scripts/sync-project-docs-to-notion.mjs",
  "skills/maintain-project-docs/scripts/validate-project-docs.mjs",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
  });
}

for (const relativePath of REQUIRED_FILES) {
  assert(existsSync(path.join(ROOT, relativePath)), `Required file is missing: ${relativePath}`);
}

const manifest = readJson(".codex-plugin/plugin.json");
const packageJson = readJson("package.json");
assert(manifest.name === "notion-project-docs", "Plugin name must be notion-project-docs.");
assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version), "Plugin version must use SemVer.");
assert(packageJson.name === manifest.name, "package.json and plugin name must match.");
assert(packageJson.version === manifest.version, "package.json and plugin version must match.");
assert(manifest.skills === "./skills/", "Manifest must point to ./skills/.");

for (const field of ["composerIcon", "logo"]) {
  const relativeAsset = manifest.interface?.[field];
  assert(typeof relativeAsset === "string", `Manifest interface.${field} is required.`);
  assert(
    existsSync(path.resolve(ROOT, relativeAsset)),
    `Manifest interface.${field} does not exist: ${relativeAsset}`,
  );
}

const skillText = readFileSync(
  path.join(ROOT, "skills", "maintain-project-docs", "SKILL.md"),
  "utf8",
);
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillText)?.[1] ?? "";
const frontmatterKeys = [...frontmatter.matchAll(/^([a-zA-Z0-9_-]+):/gm)].map(
  (match) => match[1],
);
assert(
  JSON.stringify(frontmatterKeys) === JSON.stringify(["name", "description"]),
  "SKILL.md frontmatter must contain only name and description.",
);

const workflowTemplate = readFileSync(
  path.join(
    ROOT,
    "skills",
    "maintain-project-docs",
    "assets",
    "project-docs-notion.workflow.yml",
  ),
  "utf8",
);
assert(
  workflowTemplate.split("__PROJECT_DOCS_GITHUB_ENVIRONMENT__").length === 2,
  "Workflow template must contain exactly one environment token.",
);
assert(
  (workflowTemplate.match(/--apply/g) ?? []).length === 1,
  "Workflow template must contain exactly one publication command.",
);
assert(
  workflowTemplate.includes("workflow_dispatch:") &&
    workflowTemplate.includes("inputs.confirmation == 'PUBLISH'"),
  "Workflow template must keep the manual publication gate.",
);
assert(
  workflowTemplate.includes("github.ref == needs.validate.outputs.canonical_ref") &&
    !workflowTemplate.includes("github.ref == 'refs/heads/main'"),
  "Workflow template must enforce the configured canonical branch.",
);

const setupScript = readFileSync(
  path.join(ROOT, "skills", "maintain-project-docs", "scripts", "setup-project-docs.mjs"),
  "utf8",
);
const githubProvisioner = readFileSync(
  path.join(
    ROOT,
    "skills",
    "maintain-project-docs",
    "scripts",
    "setup",
    "github-provisioner.mjs",
  ),
  "utf8",
);
const setupHtml = readFileSync(
  path.join(ROOT, "skills", "maintain-project-docs", "assets", "setup-project-docs.html"),
  "utf8",
);
assert(
  setupScript.includes('server.listen(0, "127.0.0.1"') &&
    setupScript.includes("request.headers.origin !== expectedOrigin"),
  "Setup wizard must remain loopback-only with strict origin checks.",
);
assert(
  !githubProvisioner.includes('"--body"') &&
    githubProvisioner.includes("input: value"),
  "Setup secrets must be passed to GitHub CLI through stdin.",
);
assert(
  githubProvisioner.includes('"unsupported-by-plan"') &&
    setupHtml.includes('result.environment.reviewerProtection === "unsupported-by-plan"'),
  "Setup wizard must report the required-reviewer plan fallback visibly.",
);
assert(
  githubProvisioner.includes('"--clipboard"') &&
    githubProvisioner.includes('input: "\\n"') &&
    setupHtml.includes("GitHub 일회용 코드가 클립보드에 복사되고 인증 창이 열립니다."),
  "GitHub authentication recovery must use a visible browser and clipboard device flow.",
);
assert(
  githubProvisioner.includes("const compatibleBody = {") &&
    githubProvisioner.includes("deployment_branch_policy: deploymentBranchPolicy"),
  "The plan-compatible environment fallback must omit unsupported protection-rule fields.",
);
assert(
  !/\b(?:localStorage|sessionStorage)\b/.test(setupHtml),
  "Setup UI must not persist credentials in browser storage.",
);

const textFiles = collectFiles(ROOT).filter(
  (file) =>
    !file.includes(`${path.sep}.git${path.sep}`) &&
    /\.(?:json|md|mjs|yml|yaml)$/i.test(file),
);
for (const file of textFiles) {
  const text = readFileSync(file, "utf8");
  assert(!text.includes("\uFFFD"), `Unicode replacement character found in ${path.relative(ROOT, file)}.`);
  assert(
    !/\b[A-Za-z]:\\Users\\[^\\\s]+/g.test(text),
    `User-specific Windows path found in ${path.relative(ROOT, file)}.`,
  );
}

console.log(`Distribution validation passed (${REQUIRED_FILES.length} required files).`);
