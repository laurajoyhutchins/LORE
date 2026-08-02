export function stripArgumentSeparator(argv) {
  return argv[0] === "--" ? argv.slice(1) : [...argv];
}
