import path from "node:path";

import { validateProjectDocsConfig } from "../project-docs-config.mjs";
import { syncProjectDocuments } from "../sync-project-docs-to-notion.mjs";
import { validateProjectDocuments } from "../validate-project-docs.mjs";
import { runCommand } from "./github-provisioner.mjs";

function comparablePath(value) {
  return path.resolve(value).replaceAll("\\", "/").toLocaleLowerCase();
}

async function commandOutput(run, cwd, command, args, label, trim = true) {
  try {
    const result = await run(command, args, { cwd });
    return trim ? result.stdout.trim() : result.stdout;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} failed: ${reason}`, { cause: error });
  }
}

function gitOutput(run, cwd, args, label) {
  return commandOutput(run, cwd, "git", args, label);
}

function repositoryEndpoint(repository, suffix) {
  const encodedRepository = repository
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `repos/${encodedRepository}/${suffix}`;
}

function validationFailureMessage(validation) {
  const failures = validation.issues
    .filter((issue) => issue.severity === "error")
    .slice(0, 8)
    .map((issue) => `${issue.file}:${issue.line} ${issue.message}`);
  const remaining = validation.errorCount - failures.length;
  if (remaining > 0) failures.push(`...and ${remaining} more error(s).`);
  return failures.join("\n");
}

function parseCommittedProjectConfig(context, source) {
  let rawConfig;
  try {
    rawConfig = JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot parse the committed ${context.configPath}: ${reason}`);
  }
  const committed = validateProjectDocsConfig(rawConfig);
  const committedSetupShape = {
    canonicalBranch: committed.canonicalBranch,
    publicationMode: committed.publicationMode,
    documents: committed.documents.map(({ key, label, repositoryPath }) => ({
      key,
      label,
      path: repositoryPath,
    })),
  };
  const loadedSetupShape = {
    canonicalBranch: context.canonicalBranch,
    publicationMode: context.publicationMode,
    documents: context.documents,
  };
  if (JSON.stringify(committedSetupShape) !== JSON.stringify(loadedSetupShape)) {
    throw new Error(
      "The committed project-docs configuration differs from the configuration loaded when the Wizard opened. Restart the Wizard.",
    );
  }
  return {
    ...committed,
    configPath: path.resolve(context.rootDirectory, context.configPath),
    repositoryConfigPath: context.configPath,
    rootDirectory: context.rootDirectory,
  };
}

export async function resolveInitialPublicationSource({
  context,
  repository,
  run = runCommand,
  validate = validateProjectDocuments,
}) {
  if (
    !context?.rootDirectory ||
    !context.configPath ||
    !Array.isArray(context.documents) ||
    typeof repository !== "string" ||
    !repository.includes("/")
  ) {
    throw new Error("Setup context is invalid for initial publication.");
  }

  const gitRoot = await gitOutput(
    run,
    context.rootDirectory,
    ["rev-parse", "--show-toplevel"],
    "Git repository discovery",
  );
  if (comparablePath(gitRoot) !== comparablePath(context.rootDirectory)) {
    throw new Error(
      "Initial publication requires the setup target to be the Git repository root.",
    );
  }

  const branch = await gitOutput(
    run,
    context.rootDirectory,
    ["branch", "--show-current"],
    "Current Git branch discovery",
  );
  if (branch !== context.canonicalBranch) {
    throw new Error(
      `Initial publication requires the checked-out branch to be "${context.canonicalBranch}", but found "${branch || "detached HEAD"}".`,
    );
  }

  const sourceShaBeforeValidation = await gitOutput(
    run,
    context.rootDirectory,
    ["rev-parse", "HEAD"],
    "Source commit discovery",
  );
  if (!/^[0-9a-f]{40,64}$/i.test(sourceShaBeforeValidation)) {
    throw new Error("Git returned an invalid source commit for initial publication.");
  }

  const validation = await validate({
    cwd: context.rootDirectory,
    configPath: context.configPath,
    requireTracked: true,
  });
  if (validation.errorCount > 0) {
    throw new Error(
      `Initial publication requires valid, Git-tracked project documents.\n${validationFailureMessage(validation)}`,
    );
  }

  const sourcePaths = [
    context.configPath,
    ...context.documents.map((document) => document.path),
  ];
  const dirty = await gitOutput(
    run,
    context.rootDirectory,
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...sourcePaths],
    "Project document Git status",
  );
  if (dirty) {
    throw new Error(
      "Initial publication requires the configuration and project documents to match the checked-out commit. Commit or discard these changes first:\n" +
        dirty.split(/\r?\n/).slice(0, 8).join("\n"),
    );
  }

  const sourceSha = await gitOutput(
    run,
    context.rootDirectory,
    ["rev-parse", "HEAD"],
    "Source commit confirmation",
  );
  if (sourceSha !== sourceShaBeforeValidation) {
    throw new Error(
      "The checked-out commit changed during document validation. Restart the Wizard.",
    );
  }

  const remoteSourceSha = await commandOutput(
    run,
    context.rootDirectory,
    "gh",
    [
      "api",
      repositoryEndpoint(
        repository,
        `commits/${encodeURIComponent(context.canonicalBranch)}`,
      ),
      "--jq",
      ".sha",
    ],
    "Canonical GitHub branch discovery",
  );
  if (remoteSourceSha.toLocaleLowerCase() !== sourceSha.toLocaleLowerCase()) {
    throw new Error(
      `Initial publication requires local HEAD to match the current GitHub "${context.canonicalBranch}" tip. Push the reviewed commit and update the local branch first.`,
    );
  }

  const committedConfigSource = await commandOutput(
    run,
    context.rootDirectory,
    "git",
    ["show", `${sourceSha}:${context.configPath}`],
    "Committed project-docs configuration read",
    false,
  );
  const projectConfig = parseCommittedProjectConfig(context, committedConfigSource);
  const sourceMarkdownByPath = new Map(
    await Promise.all(
      projectConfig.documents.map(async (document) => [
        document.repositoryPath,
        await commandOutput(
          run,
          context.rootDirectory,
          "git",
          ["show", `${sourceSha}:${document.repositoryPath}`],
          `${document.label} committed source read`,
          false,
        ),
      ]),
    ),
  );

  return {
    sourceSha,
    sourceSnapshot: {
      projectConfig,
      sourceMarkdownByPath,
    },
    warningCount: validation.warningCount,
  };
}

export async function verifyInitialPublicationSourceStillCurrent({
  context,
  repository,
  sourceSha,
  run = runCommand,
}) {
  const [branch, localSourceSha, remoteSourceSha] = await Promise.all([
    gitOutput(
      run,
      context.rootDirectory,
      ["branch", "--show-current"],
      "Current Git branch confirmation",
    ),
    gitOutput(
      run,
      context.rootDirectory,
      ["rev-parse", "HEAD"],
      "Source commit confirmation",
    ),
    commandOutput(
      run,
      context.rootDirectory,
      "gh",
      [
        "api",
        repositoryEndpoint(
          repository,
          `commits/${encodeURIComponent(context.canonicalBranch)}`,
        ),
        "--jq",
        ".sha",
      ],
      "Canonical GitHub branch confirmation",
    ),
  ]);

  if (
    branch !== context.canonicalBranch ||
    localSourceSha.toLocaleLowerCase() !== sourceSha.toLocaleLowerCase() ||
    remoteSourceSha.toLocaleLowerCase() !== sourceSha.toLocaleLowerCase()
  ) {
    throw new Error(
      "The canonical source changed during setup. No document body was written; restart the Wizard from the current canonical branch.",
    );
  }
}

export async function publishInitialProjectDocuments({
  context,
  notionToken,
  pageIdsJson,
  repository,
  sourceSha,
  sourceSnapshot,
  fetchImpl = fetch,
  publisher = syncProjectDocuments,
}) {
  if (
    !sourceSnapshot?.projectConfig ||
    !(sourceSnapshot.sourceMarkdownByPath instanceof Map)
  ) {
    throw new Error("Initial publication requires an immutable Git source snapshot.");
  }
  const result = await publisher({
    environment: {
      NOTION_TOKEN: notionToken,
      NOTION_PAGE_IDS_JSON: pageIdsJson,
      GITHUB_REPOSITORY: repository,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_SHA: sourceSha,
    },
    rootDirectory: context.rootDirectory,
    configPath: context.configPath,
    dryRun: false,
    fetchImpl,
    projectConfig: sourceSnapshot.projectConfig,
    sourceMarkdownByPath: sourceSnapshot.sourceMarkdownByPath,
  });

  return {
    status: "published",
    sourceSha,
    documents: result.documents,
  };
}
