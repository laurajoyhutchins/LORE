function isPackResult(value) {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0]?.filename === "string" &&
    value[0].filename !== ""
  );
}

export function parseNpmPackFilename(output) {
  if (typeof output !== "string") {
    throw new Error("RELEASE_PACKAGE_NPM_OUTPUT_INVALID");
  }

  for (
    let index = output.lastIndexOf("[");
    index >= 0;
    index = output.lastIndexOf("[", index - 1)
  ) {
    try {
      const parsed = JSON.parse(output.slice(index).trim());
      if (isPackResult(parsed)) return parsed[0].filename;
    } catch {
      continue;
    }
  }

  throw new Error("RELEASE_PACKAGE_NPM_OUTPUT_INVALID");
}
