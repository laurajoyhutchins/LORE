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

  let index = output.lastIndexOf("[");
  while (index >= 0) {
    try {
      const parsed = JSON.parse(output.slice(index).trim());
      if (isPackResult(parsed)) return parsed[0].filename;
    } catch {
      // Continue searching for an earlier array boundary.
    }
    if (index === 0) break;
    index = output.lastIndexOf("[", index - 1);
  }

  throw new Error("RELEASE_PACKAGE_NPM_OUTPUT_INVALID");
}
