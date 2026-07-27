import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadProjectDocsConfig } from "../project-docs-config.mjs";
import {
  configureGitHubEnvironment,
  discoverGitHubRepository,
  storeGitHubEnvironmentSecrets,
} from "./github-provisioner.mjs";
import {
  preflightNotionParent,
  provisionNotionMirrorPages,
} from "./notion-provisioner.mjs";

const WORKFLOW_PATH = ".github/workflows/project-docs-notion.yml";

function installedEnvironmentName(rootDirectory) {
  const workflowPath = path.join(rootDirectory, WORKFLOW_PATH);
  if (!existsSync(workflowPath)) {
    throw new Error(
      `Installed project docs workflow does not exist: ${WORKFLOW_PATH}. Run the installer first.`,
    );
  }

  const workflow = readFileSync(workflowPath, "utf8");
  const match = /^\s{4}environment:\s+(.+?)\s*$/m.exec(workflow);
  if (!match) {
    throw new Error(`Cannot find the publish environment in ${WORKFLOW_PATH}.`);
  }

  let environmentName;
  try {
    environmentName = JSON.parse(match[1]);
  } catch {
    throw new Error(`The publish environment in ${WORKFLOW_PATH} is not a JSON string.`);
  }
  if (typeof environmentName !== "string" || !environmentName.trim()) {
    throw new Error(`The publish environment in ${WORKFLOW_PATH} is empty.`);
  }
  return environmentName;
}

export function loadSetupContext({
  target = process.cwd(),
  configPath = "project-docs.config.json",
} = {}) {
  const projectConfig = loadProjectDocsConfig({
    rootDirectory: target,
    configPath,
  });

  return {
    canonicalBranch: projectConfig.canonicalBranch,
    configPath: projectConfig.repositoryConfigPath,
    documents: projectConfig.documents.map(({ key, label, repositoryPath }) => ({
      key,
      label,
      path: repositoryPath,
    })),
    environmentName: installedEnvironmentName(projectConfig.rootDirectory),
    publicationMode: projectConfig.publicationMode,
    rootDirectory: projectConfig.rootDirectory,
  };
}

export async function provisionProjectDocsSetup({
  context,
  notionToken,
  parentPage,
  pageIdsByKey = new Map(),
  github = {},
  notion = {},
}) {
  if (!context?.rootDirectory || !Array.isArray(context.documents)) {
    throw new Error("Setup context is invalid.");
  }

  const [githubRepository, notionParent] = await Promise.all([
    discoverGitHubRepository({
      cwd: context.rootDirectory,
      run: github.run,
    }),
    preflightNotionParent({
      token: notionToken,
      parentPage,
      fetchImpl: notion.fetchImpl,
    }),
  ]);

  const environment = await configureGitHubEnvironment({
    cwd: context.rootDirectory,
    repository: githubRepository.nameWithOwner,
    environmentName: context.environmentName,
    canonicalBranch: context.canonicalBranch,
    publicationMode: context.publicationMode,
    currentUser: githubRepository.currentUser,
    run: github.run,
  });

  const pages = await provisionNotionMirrorPages({
    token: notionToken,
    parentPageId: notionParent.parentPageId,
    documents: context.documents,
    pageIdsByKey,
    fetchImpl: notion.fetchImpl,
  });
  const pageIdsJson = JSON.stringify(
    Object.fromEntries(
      context.documents.map((document) => [document.key, pageIdsByKey.get(document.key)]),
    ),
  );

  const secrets = await storeGitHubEnvironmentSecrets({
    cwd: context.rootDirectory,
    repository: githubRepository.nameWithOwner,
    environmentName: context.environmentName,
    notionToken,
    pageIdsJson,
    run: github.run,
  });

  return {
    environment,
    github: {
      nameWithOwner: githubRepository.nameWithOwner,
      url: githubRepository.url,
      visibility: githubRepository.visibility,
    },
    notion: {
      botName: notionParent.botName,
      parentUrl: notionParent.parentUrl,
      pages: pages.map(({ key, label, pageUrl }) => ({ key, label, pageUrl })),
    },
    secrets,
  };
}
