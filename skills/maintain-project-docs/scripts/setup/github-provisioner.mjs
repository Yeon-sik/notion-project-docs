import { spawn } from "node:child_process";

const REQUIRED_SECRET_NAMES = ["NOTION_TOKEN", "NOTION_PAGE_IDS_JSON"];
const REQUIRED_REVIEWER_PLAN_ERROR =
  /(?:billing plan supports the required reviewers protection rule|required reviewers?.*only available|HTTP 422)/i;

function commandError(command, args, code, stderr) {
  const detail = stderr.trim().slice(0, 1_000);
  const error = new Error(
    `${command} ${args.join(" ")} failed with exit code ${code}${detail ? `: ${detail}` : "."}`,
  );
  error.code = code;
  return error;
}

export function runCommand(command, args, { cwd, input = "" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(new Error(`Cannot run ${command}: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(commandError(command, args, code, stderr));
    });

    child.stdin.end(input);
  });
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} returned invalid JSON: ${reason}`);
  }
}

function repositoryEndpoint(repository, suffix) {
  const encodedRepository = repository
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `repos/${encodedRepository}/${suffix}`;
}

function environmentEndpoint(repository, environmentName, suffix = "") {
  const base = repositoryEndpoint(
    repository,
    `environments/${encodeURIComponent(environmentName)}`,
  );
  return suffix ? `${base}/${suffix}` : base;
}

async function ghJson(run, args, { cwd, input, label }) {
  const result = await run("gh", args, { cwd, input });
  return parseJsonOutput(result, label);
}

function requiredReviewerIsUnsupported(error) {
  return (
    error instanceof Error &&
    REQUIRED_REVIEWER_PLAN_ERROR.test(error.message) &&
    /required reviewers?/i.test(error.message)
  );
}

export async function loginToGitHub({ cwd, run = runCommand } = {}) {
  await run(
    "gh",
    [
      "auth",
      "login",
      "--hostname",
      "github.com",
      "--web",
      "--git-protocol",
      "https",
      "--skip-ssh-key",
    ],
    { cwd },
  );
  return discoverGitHubRepository({ cwd, run });
}

export async function discoverGitHubRepository({ cwd, run = runCommand } = {}) {
  try {
    await run("gh", ["auth", "status", "--hostname", "github.com"], { cwd });
  } catch {
    const error = new Error(
      "GitHub CLI authentication is missing or expired. Run `gh auth login --hostname github.com --web` and retry.",
    );
    error.code = "GITHUB_AUTH_REQUIRED";
    throw error;
  }

  const repository = await ghJson(
    run,
    ["repo", "view", "--json", "nameWithOwner,visibility,url"],
    {
      cwd,
      label: "GitHub repository discovery",
    },
  );
  const user = await ghJson(run, ["api", "user"], {
    cwd,
    label: "GitHub user discovery",
  });

  if (
    typeof repository?.nameWithOwner !== "string" ||
    !repository.nameWithOwner.includes("/") ||
    !Number.isInteger(user?.id)
  ) {
    throw new Error("GitHub repository or authenticated user information is incomplete.");
  }

  return {
    currentUser: {
      id: user.id,
      login: user.login || "current user",
    },
    nameWithOwner: repository.nameWithOwner,
    url: repository.url || `https://github.com/${repository.nameWithOwner}`,
    visibility: repository.visibility || "UNKNOWN",
  };
}

export async function configureGitHubEnvironment({
  cwd,
  repository,
  environmentName,
  canonicalBranch,
  publicationMode,
  currentUser,
  run = runCommand,
}) {
  if (typeof environmentName !== "string" || !environmentName.trim()) {
    throw new Error("GitHub environment name is required.");
  }
  if (!["manual", "on-main-push"].includes(publicationMode)) {
    throw new Error("Unsupported publication mode.");
  }

  const reviewers =
    publicationMode === "manual"
      ? [
          {
            type: "User",
            id: currentUser.id,
          },
        ]
      : [];
  const endpoint = environmentEndpoint(repository, environmentName);
  const body = {
    wait_timer: 0,
    prevent_self_review: false,
    reviewers,
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  };
  let reviewerProtection =
    publicationMode === "manual" ? "required" : "not-requested";

  try {
    await ghJson(run, ["api", "--method", "PUT", endpoint, "--input", "-"], {
      cwd,
      input: JSON.stringify(body),
      label: "GitHub environment configuration",
    });
  } catch (error) {
    if (publicationMode === "manual" && requiredReviewerIsUnsupported(error)) {
      body.reviewers = [];
      try {
        await ghJson(run, ["api", "--method", "PUT", endpoint, "--input", "-"], {
          cwd,
          input: JSON.stringify(body),
          label: "GitHub environment configuration without a required reviewer",
        });
        reviewerProtection = "unsupported-by-plan";
      } catch (fallbackError) {
        const wrapped = new Error(
          `GitHub rejected both the required-reviewer policy and the compatible fallback. Confirm repository administration permission and private-repository Environment support. ${fallbackError.message}`,
        );
        wrapped.cause = fallbackError;
        throw wrapped;
      }
    } else {
      const wrapped = new Error(
        `GitHub could not configure the protected environment. Confirm repository administration permission and plan support. ${error.message}`,
      );
      wrapped.cause = error;
      throw wrapped;
    }
  }

  const policiesEndpoint = environmentEndpoint(
    repository,
    environmentName,
    "deployment-branch-policies",
  );
  const policyList = await ghJson(run, ["api", policiesEndpoint], {
    cwd,
    label: "GitHub deployment branch policy discovery",
  });
  const policies = Array.isArray(policyList?.branch_policies)
    ? policyList.branch_policies
    : [];
  let matchingPolicyFound = false;

  for (const policy of policies) {
    if (policy.name === canonicalBranch && !matchingPolicyFound) {
      matchingPolicyFound = true;
      continue;
    }
    if (!Number.isInteger(policy.id)) {
      throw new Error("GitHub returned an invalid deployment branch policy.");
    }
    await run("gh", ["api", "--method", "DELETE", `${policiesEndpoint}/${policy.id}`], {
      cwd,
    });
  }

  if (!matchingPolicyFound) {
    await ghJson(run, ["api", "--method", "POST", policiesEndpoint, "--input", "-"], {
      cwd,
      input: JSON.stringify({
        name: canonicalBranch,
        type: "branch",
      }),
      label: "GitHub deployment branch policy creation",
    });
  }

  return {
    environmentName,
    reviewer: reviewerProtection === "required" ? currentUser.login : "",
    reviewerProtection,
  };
}

async function setEnvironmentSecret({
  cwd,
  repository,
  environmentName,
  name,
  value,
  run,
}) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} cannot be empty.`);
  }
  await run(
    "gh",
    ["secret", "set", name, "--env", environmentName, "--repo", repository],
    {
      cwd,
      input: value,
    },
  );
}

export async function storeGitHubEnvironmentSecrets({
  cwd,
  repository,
  environmentName,
  notionToken,
  pageIdsJson,
  run = runCommand,
}) {
  await setEnvironmentSecret({
    cwd,
    repository,
    environmentName,
    name: "NOTION_TOKEN",
    value: notionToken,
    run,
  });
  await setEnvironmentSecret({
    cwd,
    repository,
    environmentName,
    name: "NOTION_PAGE_IDS_JSON",
    value: pageIdsJson,
    run,
  });

  const secrets = await ghJson(
    run,
    [
      "api",
      environmentEndpoint(repository, environmentName, "secrets"),
    ],
    {
      cwd,
      label: "GitHub environment secret verification",
    },
  );
  const names = new Set(
    Array.isArray(secrets?.secrets) ? secrets.secrets.map((secret) => secret.name) : [],
  );
  const missing = REQUIRED_SECRET_NAMES.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`GitHub did not report the configured secret name(s): ${missing.join(", ")}.`);
  }

  return {
    secretNames: [...REQUIRED_SECRET_NAMES],
  };
}
