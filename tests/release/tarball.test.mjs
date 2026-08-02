import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  readTarGzip,
  sha256Hex,
  sha512Integrity,
} from "../../scripts/lib/tarball.mjs";

const BLOCK = 512;

function writeString(buffer, offset, length, value) {
  buffer.write(value, offset, Math.min(length, Buffer.byteLength(value)), "utf8");
}

function writeOctal(buffer, offset, length, value) {
  writeString(
    buffer,
    offset,
    length,
    `${value.toString(8).padStart(length - 1, "0")}\0`,
  );
}

function writeChecksum(header) {
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(
    header,
    148,
    8,
    `${checksum.toString(8).padStart(6, "0")}\0 `,
  );
}

function makeHeader({ name, mode = 0o644, size, type = "0" }) {
  const header = Buffer.alloc(BLOCK);
  let fileName = name;
  let prefix = "";
  if (Buffer.byteLength(fileName) > 100) {
    const split = fileName.lastIndexOf("/");
    prefix = fileName.slice(0, split);
    fileName = fileName.slice(split + 1);
  }
  writeString(header, 0, 100, fileName);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeString(header, 345, 155, prefix);
  writeChecksum(header);
  return header;
}

function makeTarGzip(entries) {
  const parts = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? "");
    parts.push(
      makeHeader({
        name: entry.name,
        mode: entry.mode,
        size: content.length,
        type: entry.type,
      }),
      content,
      Buffer.alloc((BLOCK - (content.length % BLOCK)) % BLOCK),
    );
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts));
}

function makeTruncatedArchive() {
  const header = makeHeader({
    name: "package/file.txt",
    size: 10,
    type: "0",
  });
  return gzipSync(Buffer.concat([header, Buffer.from("x")]));
}

function makeInvalidOctalArchive() {
  const tar = gunzipSync(
    makeTarGzip([{ name: "package/file.txt", content: "x" }]),
  );
  tar[124] = "9".charCodeAt(0);
  writeChecksum(tar.subarray(0, BLOCK));
  return gzipSync(tar);
}

function makeChecksumMismatchArchive() {
  const tar = gunzipSync(
    makeTarGzip([{ name: "package/file.txt", content: "x" }]),
  );
  tar[101] = "7".charCodeAt(0);
  return gzipSync(tar);
}

describe("readTarGzip", () => {
  it("preserves exact entry bytes and modes", () => {
    const archive = makeTarGzip([
      {
        name: "package/dist/cli/main.js",
        mode: 0o755,
        content: "#!/usr/bin/env node\n",
      },
    ]);

    const entries = readTarGzip(archive);

    expect(entries).toMatchObject([
      {
        name: "package/dist/cli/main.js",
        type: "0",
        mode: 0o755,
        size: 20,
      },
    ]);
    expect(entries[0].content.equals(Buffer.from("#!/usr/bin/env node\n"))).toBe(
      true,
    );
  });

  it.each([
    ["truncated body", makeTruncatedArchive(), "TAR_ENTRY_TRUNCATED"],
    ["invalid octal", makeInvalidOctalArchive(), "TAR_OCTAL_INVALID"],
    [
      "checksum mismatch",
      makeChecksumMismatchArchive(),
      "TAR_CHECKSUM_INVALID",
    ],
    [
      "parent path",
      makeTarGzip([{ name: "package/../escape", content: "x" }]),
      "TAR_PATH_INVALID",
    ],
    [
      "absolute path",
      makeTarGzip([{ name: "/package/escape", content: "x" }]),
      "TAR_PATH_INVALID",
    ],
    [
      "duplicate path",
      makeTarGzip([
        { name: "package/file.txt", content: "x" },
        { name: "package/file.txt", content: "y" },
      ]),
      "TAR_PATH_DUPLICATE",
    ],
  ])("rejects %s", (_name, archive, code) => {
    expect(() => readTarGzip(archive)).toThrow(code);
  });

  it("requires two terminal zero blocks", () => {
    const tar = gunzipSync(
      makeTarGzip([{ name: "package/file.txt", content: "x" }]),
    );
    expect(() => readTarGzip(gzipSync(tar.subarray(0, -BLOCK)))).toThrow(
      "TAR_TERMINATOR_MISSING",
    );
  });

  it("rejects non-zero bytes after the terminator", () => {
    const tar = gunzipSync(makeTarGzip([]));
    expect(() =>
      readTarGzip(gzipSync(Buffer.concat([tar, Buffer.from("x")]))),
    ).toThrow("TAR_TRAILING_DATA");
  });
});

describe("artifact digests", () => {
  it("computes stable digests", () => {
    const bytes = Buffer.from("lore");
    expect(sha256Hex(bytes)).toBe(
      "b6598e838f350a97cb734eca208ce0cdc602dd60afbf65a3b8b65195cbd1a7fe",
    );
    expect(sha512Integrity(bytes)).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/);
  });
});
