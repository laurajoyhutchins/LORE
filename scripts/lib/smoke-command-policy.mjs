export const SMOKE_COMMAND_TIMEOUT_MS = 120_000;

const NPM_INSTALL_SAFETY_FLAGS = Object.freeze([
  "--no-audit",
  "--no-fund",
  "--ignore-scripts",
  "--package-lock=false",
]);

export function npmInstallArguments(tarballPath, options = {}) {
  const arguments_ = ["install", ...NPM_INSTALL_SAFETY_FLAGS];
  if (options.global === true) {
    if (typeof options.prefix !== "string" || options.prefix === "") {
      throw new Error("SMOKE_GLOBAL_PREFIX_INVALID");
    }
    arguments_.push("--global", "--prefix", options.prefix);
  }
  arguments_.push(tarballPath);
  return arguments_;
}

export function npmExecArguments(loreArguments) {
  return [
    "exec",
    "--offline",
    "--yes=false",
    "--",
    "lore",
    ...loreArguments,
  ];
}
