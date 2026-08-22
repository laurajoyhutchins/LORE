#!/usr/bin/env node
import process from 'node:process';
import { extractRepository, initializeRepository, projectDocumentation, selectContext, validateKnowledge } from '../core.js';

const HELP = `LORE — maintenance-mode repository documentation utility\n\nUsage:\n  lore init [root] [--json]\n  lore extract [root] [--json]\n  lore validate [root] [--json]\n  lore project [root] [--check] [--json]\n  lore context <query> [root] [--max-records N] [--max-bytes N] [--json]\n\nLORE keeps reviewed repository knowledge beside source code, validates it, and\nprojects concise current documentation. Git is the history and review system.\n`;
function takeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}
function takeValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  args.splice(index, 2);
  return value;
}
function positiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  return number;
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = takeFlag(args, '--json');
  const command = args.shift();
  if (!command || command === 'help' || command === '--help' || command === '-h') { process.stdout.write(HELP); return; }
  let result: unknown;
  if (command === 'init') {
    const root = args.shift() ?? process.cwd();
    if (args.length > 0) throw new Error(`unexpected arguments: ${args.join(' ')}`);
    await initializeRepository(root);
    result = { ok: true, command, root };
  } else if (command === 'extract') {
    const root = args.shift() ?? process.cwd();
    if (args.length > 0) throw new Error(`unexpected arguments: ${args.join(' ')}`);
    result = await extractRepository(root);
  } else if (command === 'validate') {
    const root = args.shift() ?? process.cwd();
    if (args.length > 0) throw new Error(`unexpected arguments: ${args.join(' ')}`);
    result = await validateKnowledge(root);
  } else if (command === 'project') {
    const check = takeFlag(args, '--check');
    const root = args.shift() ?? process.cwd();
    if (args.length > 0) throw new Error(`unexpected arguments: ${args.join(' ')}`);
    result = await projectDocumentation(root, { check });
  } else if (command === 'context') {
    const maxRecords = positiveInteger(takeValue(args, '--max-records'), '--max-records');
    const maxBytes = positiveInteger(takeValue(args, '--max-bytes'), '--max-bytes');
    const query = args.shift();
    if (!query) throw new Error('context requires a query');
    const root = args.shift() ?? process.cwd();
    if (args.length > 0) throw new Error(`unexpected arguments: ${args.join(' ')}`);
    const options: { maxRecords?: number; maxBytes?: number } = {};
    if (maxRecords !== undefined) options.maxRecords = maxRecords;
    if (maxBytes !== undefined) options.maxBytes = maxBytes;
    result = await selectContext(root, query, options);
  } else {
    throw new Error(`unknown command: ${command}`);
  }
  if (json || command === 'extract' || command === 'context') process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`ok: ${command}\n`);
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
});
