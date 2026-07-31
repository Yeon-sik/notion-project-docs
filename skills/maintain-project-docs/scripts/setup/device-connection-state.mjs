import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const STATE_VERSION = 1;
const MAX_STATE_BYTES = 8 * 1024;

function emptyState() {
  return {
    notionToken: "",
    lastParentPage: "",
  };
}

function assertStateFileTarget(statePath) {
  if (!existsSync(statePath)) return;
  const stats = lstatSync(statePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("The device connection state path must be a regular file.");
  }
  if (stats.size > MAX_STATE_BYTES) {
    throw new Error("The device connection state file is unexpectedly large.");
  }
}

function validateStateValue(value, field, maximumLength, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`Device connection state ${field} is invalid.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`Device connection state ${field} is too long.`);
  }
  return normalized;
}

export function resolveDeviceConnectionStatePath({
  environment = process.env,
  homeDirectory = homedir(),
  platform = process.platform,
} = {}) {
  let baseDirectory;
  if (platform === "win32") {
    baseDirectory =
      environment.LOCALAPPDATA || path.join(homeDirectory, "AppData", "Local");
  } else if (platform === "darwin") {
    baseDirectory = path.join(homeDirectory, "Library", "Application Support");
  } else {
    baseDirectory = environment.XDG_CONFIG_HOME || path.join(homeDirectory, ".config");
  }
  return path.join(baseDirectory, "notion-project-docs", "connection-state.json");
}

export function loadDeviceConnectionState({
  statePath = resolveDeviceConnectionStatePath(),
} = {}) {
  if (!existsSync(statePath)) return emptyState();
  assertStateFileTarget(statePath);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    throw new Error("The device connection state file is not valid JSON.");
  }
  if (!parsed || parsed.version !== STATE_VERSION) {
    throw new Error("The device connection state version is not supported.");
  }

  return {
    notionToken: validateStateValue(parsed.notionToken, "Notion token", 512),
    lastParentPage: validateStateValue(
      parsed.lastParentPage,
      "last parent page URL",
      2_048,
      { allowEmpty: true },
    ),
  };
}

export function saveDeviceConnectionState({
  notionToken,
  lastParentPage,
  statePath = resolveDeviceConnectionStatePath(),
}) {
  const nextState = {
    notionToken: validateStateValue(notionToken, "Notion token", 512),
    lastParentPage: validateStateValue(
      lastParentPage,
      "last parent page URL",
      2_048,
    ),
  };
  const stateDirectory = path.dirname(statePath);
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  assertStateFileTarget(statePath);
  const temporaryPath = `${statePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({ version: STATE_VERSION, ...nextState }, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, statePath);
    chmodSync(statePath, 0o600);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return nextState;
}
