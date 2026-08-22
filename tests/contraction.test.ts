import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractRepository,
  initializeRepository,
  loadKnowledge,
  projectDocumentation,
  selectContext,
  validateKnowledge,
} from '../src/core.js';

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'lore-contract-'));
}

async function seedKnowledge(root: string): Promise<void> {
  await initializeRepository(root);
  await writeFile(
    path.join(root, '.lore/knowledge/repository.yaml'),
    [
      'id: repository.example',
      'kind: overview',
      'title: Example repository',
      'summary: A deterministic example repository.',
      'evidence:',
      '  - path: package.json',
      '',
      '---',
      'id: component.engine',
      'kind: component',
      'title: Engine',
      'summary: Resolves repository facts.',
      'details:',
      '  - Uses deterministic local inputs.',
      'related:',
      '  - repository.example',
      'evidence:',
      '  - path: src/index.ts',
      '',
    ].join('\n'),
  );
}

describe('maintenance-mode contract', () => {
  it('initializes minimally and never claims an existing README', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'README.md'), '# Human README\n');
    await initializeRepository(root);
    expect(await readFile(path.join(root, 'README.md'), 'utf8')).toBe('# Human README\n');
    expect(await readFile(path.join(root, 'lore.yaml'), 'utf8')).toContain('generated_dir: docs/lore');
    expect(await readFile(path.join(root, '.lore/knowledge/README.md'), 'utf8')).toContain('reviewed repository knowledge');
  });

  it('extracts deterministic repository facts', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'package.json'), '{"name":"example"}\n');
    const first = await extractRepository(root);
    const second = await extractRepository(root);
    expect(second).toEqual(first);
    expect(first.files.map((file) => file.path)).toContain('package.json');
  });

  it('fails closed when maintained knowledge is invalid', async () => {
    const root = await repo();
    await initializeRepository(root);
    await writeFile(path.join(root, '.lore/knowledge/bad.yaml'), 'id: bad\nkind: platform\nsummary: nope\n');
    await expect(validateKnowledge(root)).rejects.toThrow(/invalid knowledge/i);
  });

  it('loads compact relationships without requiring a causal graph', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'package.json'), '{}\n');
    await writeFile(path.join(root, 'src/index.ts'), 'export {};\n', { flag: 'wx' }).catch(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(path.join(root, 'src'), { recursive: true });
      await writeFile(path.join(root, 'src/index.ts'), 'export {};\n');
    });
    await seedKnowledge(root);
    const records = await loadKnowledge(root);
    expect(records[1]?.related).toEqual(['repository.example']);
    expect(records[1]).not.toHaveProperty('causes');
  });

  it('projects deterministic current documentation without touching README', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'README.md'), '# Human README\n');
    await writeFile(path.join(root, 'package.json'), '{}\n');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src/index.ts'), 'export {};\n');
    await seedKnowledge(root);
    const first = await projectDocumentation(root);
    const second = await projectDocumentation(root);
    expect(second).toEqual(first);
    expect(await readFile(path.join(root, 'README.md'), 'utf8')).toBe('# Human README\n');
    expect(first.files.sort()).toEqual([
      'docs/lore/architecture.md',
      'docs/lore/decisions.md',
      'docs/lore/guidance.md',
      'docs/lore/overview.md',
    ]);
  });

  it('keeps context deterministic, bounded, and explainable', async () => {
    const root = await repo();
    await writeFile(path.join(root, 'package.json'), '{}\n');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src/index.ts'), 'export {};\n');
    await seedKnowledge(root);
    const first = await selectContext(root, 'engine repository facts', { maxRecords: 1, maxBytes: 5000 });
    const second = await selectContext(root, 'engine repository facts', { maxRecords: 1, maxBytes: 5000 });
    expect(second).toEqual(first);
    expect(first.records).toHaveLength(1);
    expect(first.bytes).toBeLessThanOrEqual(5000);
    expect(first.records[0]?.reason).toMatch(/matched/i);
  });
});
