import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const BLOCK_SIZE = 512;

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function readTextField(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const nul = field.indexOf(0);
  return field
    .subarray(0, nul < 0 ? field.length : nul)
    .toString("utf8")
    .trimEnd();
}

function readOctalField(header, offset, length) {
  const raw = header
    .subarray(offset, offset + length)
    .toString("ascii")
    .replace(/[\0 ]+$/u, "")
    .trimStart();
  if (raw === "") return 0;
  if (!/^[0-7]+$/u.test(raw)) throw new Error(`TAR_OCTAL_INVALID: ${raw}`);
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value)) throw new Error(`TAR_OCTAL_INVALID: ${raw}`);
  return value;
}

function validatePath(name) {
  if (
    name === "" ||
    name.startsWith("/") ||
    /^[A-Za-z]:/u.test(name) ||
    name.includes("\\")
  ) {
    fail("TAR_PATH_INVALID", name);
  }
  const segments = name.split("/");
  const effective = name.endsWith("/") ? segments.slice(0, -1) : segments;
  if (
    effective.length === 0 ||
    effective.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    fail("TAR_PATH_INVALID", name);
  }
}

function isZeroBlock(block) {
  return block.every((byte) => byte === 0);
}

export function readTarGzip(bytes) {
  let tar;
  try {
    tar = gunzipSync(bytes);
  } catch (error) {
    fail(
      "TAR_GZIP_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }

  const entries = [];
  const paths = new Set();
  let offset = 0;

  while (offset + BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    if (isZeroBlock(header)) {
      if (offset + BLOCK_SIZE * 2 > tar.length) fail("TAR_TERMINATOR_MISSING");
      const second = tar.subarray(
        offset + BLOCK_SIZE,
        offset + BLOCK_SIZE * 2,
      );
      if (!isZeroBlock(second)) fail("TAR_TERMINATOR_MISSING");
      const trailing = tar.subarray(offset + BLOCK_SIZE * 2);
      if (!trailing.every((byte) => byte === 0)) fail("TAR_TRAILING_DATA");
      return entries;
    }

    const shortName = readTextField(header, 0, 100);
    const prefix = readTextField(header, 345, 155);
    const name = prefix === "" ? shortName : `${prefix}/${shortName}`;
    validatePath(name);
    if (paths.has(name)) fail("TAR_PATH_DUPLICATE", name);
    paths.add(name);

    const mode = readOctalField(header, 100, 8);
    const size = readOctalField(header, 124, 12);
    const typeByte = header[156];
    const type = typeByte === 0 ? "0" : String.fromCharCode(typeByte);
    const contentStart = offset + BLOCK_SIZE;
    const contentEnd = contentStart + size;
    const paddedEnd =
      contentStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    if (contentEnd > tar.length || paddedEnd > tar.length) {
      fail("TAR_ENTRY_TRUNCATED", name);
    }
    const padding = tar.subarray(contentEnd, paddedEnd);
    if (!padding.every((byte) => byte === 0)) {
      fail("TAR_PADDING_INVALID", name);
    }

    entries.push({
      name,
      type,
      mode,
      size,
      content: Buffer.from(tar.subarray(contentStart, contentEnd)),
    });
    offset = paddedEnd;
  }

  fail("TAR_TERMINATOR_MISSING");
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha512Integrity(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}
