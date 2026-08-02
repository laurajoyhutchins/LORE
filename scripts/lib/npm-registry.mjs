import { spawnSync } from "node:child_process";
import process from "node:process";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function validateIntegrity(value) {
  if (typeof value !== "string" || !value.startsWith("sha512-")) {
    fail("NPM_INTEGRITY_INVALID", String(value));
  }
  const encoded = value.slice("sha512-".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) || encoded.length % 4 !== 0) {
    fail("NPM_INTEGRITY_INVALID", value);
  }
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 64 || decoded.toString("base64") !== encoded) {
    fail("NPM_INTEGRITY_INVALID", value);
  }
  return value;
}

export function classifyPublishedVersion(expectedIntegrity, observedIntegrity) {
  validateIntegrity(expectedIntegrity);
  if (observedIntegrity === null) return "absent";
  validateIntegrity(observedIntegrity);
  return observedIntegrity === expectedIntegrity ? "matching" : "conflict";
}

export function parsePublishedIntegrityOutput(output) {
  let value;
  try {
    value = JSON.parse(output);
  } catch (error) {
    fail(
      "NPM_VIEW_OUTPUT_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (typeof value !== "string") {
    fail("NPM_VIEW_OUTPUT_INVALID", String(value));
  }
  try {
    return validateIntegrity(value);
  } catch (error) {
    fail(
      "NPM_VIEW_OUTPUT_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function publicationEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name, value]) =>
        value !== undefined && name !== "NODE_AUTH_TOKEN" && name !== "NPM_TOKEN",
    ),
  );
}

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function readPublishedIntegrity(
  name,
  version,
  environment = publicationEnvironment(),
) {
  const result = spawnSync(
    npmExecutable(),
    ["view", `${name}@${version}`, "dist.integrity", "--json"],
    {
      encoding: "utf8",
      stdio: "pipe",
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
      shell: process.platform === "win32",
    },
  );
  if (result.error) fail("NPM_VIEW_START_FAILED", result.error.message);
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (/\bE404\b/u.test(detail)) return null;
    fail("NPM_VIEW_FAILED", detail || `exit ${String(result.status)}`);
  }
  return parsePublishedIntegrityOutput(result.stdout);
}
