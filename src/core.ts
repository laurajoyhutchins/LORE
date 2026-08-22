import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, parseAllDocuments } from 'yaml';

export const KNOWLEDGE_KINDS = ['overview', 'component', 'decision', 'constraint', 'procedure', 'note'] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export interface EvidenceReference { path: string; note?: string; lines?: string }
export interface KnowledgeRecord {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  details?: string[];
  evidence?: EvidenceReference[];
  related?: string[];
  tags?: string[];
}
export interface LoreConfig {
  version: 1;
  knowledge_dir: string;
  generated_dir: string;
  context: { max_records: number; max_bytes: number };
}
export interface ExtractedFile { path: string; size: number; sha256: string }
export interface ExtractionSnapshot { version: 1; files: ExtractedFile[] }
export interface ContextRecord { record: KnowledgeRecord; reason: string; score: number }
export interface ContextResult { query: string; records: ContextRecord[]; bytes: number; maxRecords: number; maxBytes: number }

const DEFAULT_CONFIG: LoreConfig = {
  version: 1,
  knowledge_dir: '.lore/knowledge',
  generated_dir: 'docs/lore',
  context: { max_records: 12, max_bytes: 24_000 },
};
const DEFAULT_CONFIG_TEXT = `version: 1\nknowledge_dir: .lore/knowledge\ngenerated_dir: docs/lore\ncontext:\n  max_records: 12\n  max_bytes: 24000\n`;
const KNOWLEDGE_README = `# LORE knowledge\n\nThis directory contains reviewed repository knowledge. Git commits and pull requests are the change history and review mechanism.\n\nEach YAML or JSON document is a compact record with: id, kind, title, summary, and optional details, evidence, related, and tags. Generated documentation is non-authoritative.\n`;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`invalid knowledge: ${field} must be a non-empty string`);
  return value;
}
function optionalStrings(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`invalid knowledge: ${field} must be an array of non-empty strings`);
  }
  return value as string[];
}
function recordFromUnknown(value: unknown, source: string): KnowledgeRecord {
  if (!isObject(value)) throw new Error(`invalid knowledge in ${source}: record must be an object`);
  const allowed = new Set(['id', 'kind', 'title', 'summary', 'details', 'evidence', 'related', 'tags']);
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (extra.length > 0) throw new Error(`invalid knowledge in ${source}: unsupported fields: ${extra.sort().join(', ')}`);
  const id = assertString(value.id, `${source}.id`);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new Error(`invalid knowledge in ${source}: id contains unsupported characters`);
  const kind = assertString(value.kind, `${source}.kind`);
  if (!(KNOWLEDGE_KINDS as readonly string[]).includes(kind)) throw new Error(`invalid knowledge in ${source}: unsupported kind ${kind}`);
  const title = assertString(value.title, `${source}.title`);
  const summary = assertString(value.summary, `${source}.summary`);
  const details = optionalStrings(value.details, `${source}.details`);
  const related = optionalStrings(value.related, `${source}.related`);
  const tags = optionalStrings(value.tags, `${source}.tags`);
  let evidence: EvidenceReference[] | undefined;
  if (value.evidence !== undefined) {
    if (!Array.isArray(value.evidence)) throw new Error(`invalid knowledge in ${source}: evidence must be an array`);
    evidence = value.evidence.map((item, index) => {
      if (!isObject(item)) throw new Error(`invalid knowledge in ${source}: evidence[${index}] must be an object`);
      if (Object.keys(item).some((key) => !['path', 'note', 'lines'].includes(key))) throw new Error(`invalid knowledge in ${source}: unsupported evidence field`);
      const reference: EvidenceReference = { path: assertString(item.path, `${source}.evidence[${index}].path`) };
      if (item.note !== undefined) reference.note = assertString(item.note, `${source}.evidence[${index}].note`);
      if (item.lines !== undefined) reference.lines = assertString(item.lines, `${source}.evidence[${index}].lines`);
      return reference;
    });
  }
  const record: KnowledgeRecord = { id, kind: kind as KnowledgeKind, title, summary };
  if (details) record.details = details;
  if (evidence) record.evidence = evidence;
  if (related) record.related = related;
  if (tags) record.tags = tags;
  return record;
}
function contained(root: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new Error(`path must be repository-relative: ${relative}`);
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, relative);
  if (target !== rootPath && !target.startsWith(`${rootPath}${path.sep}`)) throw new Error(`path escapes repository: ${relative}`);
  return target;
}
async function lstatIfPresent(file: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try { return await lstat(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
async function safeContained(root: string, relative: string): Promise<string> {
  const rootPath = path.resolve(root);
  const target = contained(rootPath, relative);
  const relation = path.relative(rootPath, target);
  if (relation === '') return target;
  let current = rootPath;
  for (const segment of relation.split(path.sep)) {
    current = path.join(current, segment);
    const info = await lstatIfPresent(current);
    if (info === undefined) break;
    if (info.isSymbolicLink()) throw new Error(`path escapes repository through symlink: ${relative}`);
  }
  return target;
}
async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function writeIfMissing(file: string, content: string): Promise<void> {
  if (await exists(file)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

export async function loadConfig(root: string): Promise<LoreConfig> {
  const configPath = await safeContained(root, 'lore.yaml');
  if (!(await exists(configPath))) return DEFAULT_CONFIG;
  const value: unknown = parse(await readFile(configPath, 'utf8'));
  if (!isObject(value) || value.version !== 1) throw new Error('invalid lore.yaml: version must be 1');
  const extra = Object.keys(value).filter((key) => !['version', 'knowledge_dir', 'generated_dir', 'context'].includes(key));
  if (extra.length > 0) throw new Error(`invalid lore.yaml: unsupported fields: ${extra.sort().join(', ')}`);
  const knowledgeDir = assertString(value.knowledge_dir, 'lore.yaml knowledge_dir');
  const generatedDir = assertString(value.generated_dir, 'lore.yaml generated_dir');
  await safeContained(root, knowledgeDir);
  await safeContained(root, generatedDir);
  let maxRecords = DEFAULT_CONFIG.context.max_records;
  let maxBytes = DEFAULT_CONFIG.context.max_bytes;
  if (value.context !== undefined) {
    if (!isObject(value.context)) throw new Error('invalid lore.yaml: context must be an object');
    const contextExtra = Object.keys(value.context).filter((key) => !['max_records', 'max_bytes'].includes(key));
    if (contextExtra.length > 0) throw new Error(`invalid lore.yaml: unsupported context fields: ${contextExtra.sort().join(', ')}`);
    const configuredRecords = value.context.max_records;
    const configuredBytes = value.context.max_bytes;
    if (typeof configuredRecords !== 'number' || !Number.isInteger(configuredRecords) || configuredRecords < 1) throw new Error('invalid lore.yaml: context.max_records must be a positive integer');
    if (typeof configuredBytes !== 'number' || !Number.isInteger(configuredBytes) || configuredBytes < 256) throw new Error('invalid lore.yaml: context.max_bytes must be an integer >= 256');
    maxRecords = configuredRecords;
    maxBytes = configuredBytes;
  }
  return { version: 1, knowledge_dir: knowledgeDir, generated_dir: generatedDir, context: { max_records: maxRecords, max_bytes: maxBytes } };
}

export async function initializeRepository(root: string): Promise<void> {
  const rootPath = path.resolve(root);
  await mkdir(rootPath, { recursive: true });
  const configPath = await safeContained(rootPath, 'lore.yaml');
  await writeIfMissing(configPath, DEFAULT_CONFIG_TEXT);
  const config = await loadConfig(rootPath);
  const knowledgeDir = await safeContained(rootPath, config.knowledge_dir);
  const generatedDir = await safeContained(rootPath, config.generated_dir);
  await mkdir(knowledgeDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });
  const knowledgeReadme = await safeContained(rootPath, path.join(config.knowledge_dir, 'README.md'));
  await writeIfMissing(knowledgeReadme, KNOWLEDGE_README);
}
async function listFiles(directory: string): Promise<string[]> {
  if (!(await exists(directory))) return [];
  const result: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) result.push(full);
    }
  }
  await visit(directory);
  return result;
}

export async function loadKnowledge(root: string): Promise<KnowledgeRecord[]> {
  const config = await loadConfig(root);
  const knowledgeDir = await safeContained(root, config.knowledge_dir);
  const files = (await listFiles(knowledgeDir)).filter((file) => ['.yaml', '.yml', '.json'].includes(path.extname(file).toLowerCase()));
  const records: KnowledgeRecord[] = [];
  for (const file of files) {
    const relative = path.relative(path.resolve(root), file).split(path.sep).join('/');
    const text = await readFile(file, 'utf8');
    if (path.extname(file).toLowerCase() === '.json') {
      const parsed: unknown = JSON.parse(text);
      const values: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      values.forEach((value, index) => records.push(recordFromUnknown(value, `${relative}#${index + 1}`)));
    } else {
      const documents = parseAllDocuments(text);
      for (const [index, document] of documents.entries()) {
        if (document.errors.length > 0) throw new Error(`invalid knowledge in ${relative}: ${document.errors[0]?.message ?? 'YAML parse error'}`);
        if (document.contents === null) continue;
        records.push(recordFromUnknown(document.toJSON(), `${relative}#${index + 1}`));
      }
    }
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}

export async function validateKnowledge(root: string): Promise<{ valid: true; records: number }> {
  const records = await loadKnowledge(root);
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`invalid knowledge: duplicate id ${record.id}`);
    ids.add(record.id);
  }
  for (const record of records) {
    for (const related of record.related ?? []) if (!ids.has(related)) throw new Error(`invalid knowledge: ${record.id} relates to unknown record ${related}`);
    for (const evidence of record.evidence ?? []) {
      const evidencePath = await safeContained(root, evidence.path);
      if (!(await exists(evidencePath))) throw new Error(`invalid knowledge: evidence path does not exist: ${evidence.path}`);
    }
  }
  return { valid: true, records: records.length };
}
async function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
export async function extractRepository(root: string): Promise<ExtractionSnapshot> {
  const rootPath = path.resolve(root);
  const config = await loadConfig(rootPath);
  const generatedPath = await safeContained(rootPath, config.generated_dir);
  const ignoredNames = new Set(['.git', 'node_modules', 'dist', 'coverage']);
  const files: ExtractedFile[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredNames.has(entry.name) || full === generatedPath) continue;
        await visit(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        files.push({ path: path.relative(rootPath, full).split(path.sep).join('/'), size: info.size, sha256: await sha256(full) });
      }
    }
  }
  await visit(rootPath);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { version: 1, files };
}
function evidenceText(reference: EvidenceReference): string {
  const location = reference.lines ? `${reference.path}#${reference.lines}` : reference.path;
  return reference.note ? `\`${location}\` — ${reference.note}` : `\`${location}\``;
}
function renderRecords(title: string, records: KnowledgeRecord[]): string {
  const lines = [`# ${title}`, '', '> Generated by LORE from reviewed repository knowledge. This document is non-authoritative.', ''];
  if (records.length === 0) { lines.push('_No maintained records._', ''); return `${lines.join('\n')}\n`; }
  for (const record of records.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))) {
    lines.push(`## ${record.title}`, '', record.summary, '');
    for (const detail of record.details ?? []) lines.push(`- ${detail}`);
    if ((record.details?.length ?? 0) > 0) lines.push('');
    if ((record.evidence?.length ?? 0) > 0) {
      lines.push('Evidence:', '');
      for (const reference of record.evidence ?? []) lines.push(`- ${evidenceText(reference)}`);
      lines.push('');
    }
    if ((record.related?.length ?? 0) > 0) lines.push(`Related: ${record.related?.map((id) => `\`${id}\``).join(', ')}`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
export async function projectDocumentation(root: string, options: { check?: boolean } = {}): Promise<{ files: string[] }> {
  await validateKnowledge(root);
  const config = await loadConfig(root);
  const records = await loadKnowledge(root);
  const projections: Record<string, string> = {
    'overview.md': renderRecords('Repository overview', records.filter((record) => record.kind === 'overview')),
    'architecture.md': renderRecords('Architecture and components', records.filter((record) => record.kind === 'component')),
    'decisions.md': renderRecords('Decisions and constraints', records.filter((record) => record.kind === 'decision' || record.kind === 'constraint')),
    'guidance.md': renderRecords('Maintainer and agent guidance', records.filter((record) => record.kind === 'procedure' || record.kind === 'note')),
  };
  const generatedDir = await safeContained(root, config.generated_dir);
  const files: string[] = [];
  for (const name of Object.keys(projections).sort()) {
    const relative = path.join(config.generated_dir, name).split(path.sep).join('/');
    const file = await safeContained(root, relative);
    const content = projections[name];
    if (content === undefined) continue;
    files.push(relative);
    if (options.check) {
      if (!(await exists(file)) || (await readFile(file, 'utf8')) !== content) throw new Error(`generated documentation is stale: ${relative}`);
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, 'utf8');
    }
  }
  return { files };
}
function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) ?? [])].sort();
}
function scoreRecord(record: KnowledgeRecord, queryTokens: string[]): { score: number; matches: string[] } {
  const title = tokens(record.title);
  const summary = tokens(record.summary);
  const rest = tokens([...(record.details ?? []), ...(record.tags ?? []), ...(record.evidence ?? []).map((item) => item.path)].join(' '));
  let score = 0;
  const matches: string[] = [];
  for (const token of queryTokens) {
    let matched = false;
    if (title.includes(token)) { score += 3; matched = true; }
    if (summary.includes(token)) { score += 2; matched = true; }
    if (rest.includes(token)) { score += 1; matched = true; }
    if (matched) matches.push(token);
  }
  return { score, matches };
}
export async function selectContext(root: string, query: string, options: { maxRecords?: number; maxBytes?: number } = {}): Promise<ContextResult> {
  await validateKnowledge(root);
  const config = await loadConfig(root);
  const maxRecords = options.maxRecords ?? config.context.max_records;
  const maxBytes = options.maxBytes ?? config.context.max_bytes;
  if (!Number.isInteger(maxRecords) || maxRecords < 1) throw new Error('maxRecords must be a positive integer');
  if (!Number.isInteger(maxBytes) || maxBytes < 256) throw new Error('maxBytes must be at least 256');
  const queryTokens = tokens(query);
  const records = await loadKnowledge(root);
  const ranked = records.map((record) => ({ record, ...scoreRecord(record, queryTokens) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
  if (ranked.length === 0) {
    const overview = records.filter((record) => record.kind === 'overview').sort((a, b) => a.id.localeCompare(b.id));
    for (const record of overview) ranked.push({ record, score: 0, matches: [] });
  }
  const selected: ContextRecord[] = [];
  let bytes = 0;
  for (const candidate of ranked) {
    if (selected.length >= maxRecords) break;
    const reason = candidate.matches.length > 0 ? `matched: ${candidate.matches.join(', ')}` : 'fallback: repository overview';
    const result: ContextRecord = { record: candidate.record, reason, score: candidate.score };
    const size = Buffer.byteLength(JSON.stringify(result), 'utf8');
    if (bytes + size > maxBytes) continue;
    selected.push(result);
    bytes += size;
  }
  return { query, records: selected, bytes, maxRecords, maxBytes };
}
