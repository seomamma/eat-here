// Minimal typings for the Node built-ins the asset tests use (no @types/node dependency).
declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: string[],
    options: { cwd: string; encoding: 'utf8' },
  ): string;
}
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { cwd(): string };
