// Where the project sits in its git repository, and the hook dispatcher shared by every aquila package
// (aquila-ai, aquila-react-ai, aquila-next-ai). Package-agnostic on purpose: the three packages ship this
// file and githooks/* byte-identical, so whichever `init` runs last writes the same dispatcher.
//
// Protocol v1:
//   <repo>/.aquila-hooks/pre-commit, pre-push  dispatcher (copied from githooks/), core.hooksPath = .aquila-hooks
//   <repo>/.aquila-hooks/projects              "<package> <dir>" per line; <dir> from the repo root, "." = root
//   <repo>/.aquila-hooks/.gitattributes        "* text eol=lf" (sh breaks on CRLF checkouts)
// The dispatcher runs `node <dir>/node_modules/<package>/bin/aquila.mjs gate <phase>` inside each project
// whose folder has changes (staged files for pre-commit, commits being pushed for pre-push).
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DISPATCH_DIR = '.aquila-hooks';
export const REGISTRY = `${DISPATCH_DIR}/projects`;
export const PHASES = ['pre-commit', 'pre-push'];
const REGISTRY_HEAD =
  '# aquila projects sharing this hook dispatcher: "<package> <dir>" (dir from the repo root; "." = root).\n# Maintained by `npx <package> init`; commit it.\n';

const run = (cwd, ...args) => {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).replace(/\r?\n$/, '');
  } catch {
    return null;
  }
};

/**
 * { top, prefix, dir }: repository root, the project's path from it with a trailing slash ("" at the root)
 * and the same as a registry dir ("." at the root). Without git, the project is its own root.
 */
export function layout(root) {
  const cdup = run(root, 'rev-parse', '--show-cdup');
  if (cdup === null) return { git: false, top: root, prefix: '', dir: '.' };
  const prefix = run(root, 'rev-parse', '--show-prefix') ?? '';
  return { git: true, top: resolve(root, cdup || '.'), prefix, dir: prefix.replace(/\/$/, '') || '.' };
}

/** Registry entries: [{ pkg, dir }], comments and blank lines ignored, CRLF tolerated. */
export function readRegistry(top) {
  const file = join(top, REGISTRY);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [pkg, ...rest] = line.trim().split(' ');
      return { pkg, dir: rest.join(' ') || '.' };
    });
}

/** Adds/updates "<pkg> <dir>" (one line per dir); true when the file changed. */
export function register(top, pkg, dir) {
  const entries = readRegistry(top).filter((e) => e.dir !== dir);
  entries.push({ pkg, dir });
  entries.sort((a, b) => a.dir.localeCompare(b.dir));
  const next = `${REGISTRY_HEAD}${entries.map((e) => `${e.pkg} ${e.dir}`).join('\n')}\n`;
  const file = join(top, REGISTRY);
  if (existsSync(file) && readFileSync(file, 'utf8') === next) return false;
  mkdirSync(join(top, DISPATCH_DIR), { recursive: true });
  writeFileSync(file, next);
  return true;
}

const versionOf = (text) => Number(/aquila-hooks dispatcher v(\d+)/.exec(text)?.[1] ?? 0);

/**
 * Writes the dispatcher from `pkgDir/githooks`, never downgrading one written by a newer aquila package.
 * Returns the phases written.
 */
export function writeDispatcher(top, pkgDir) {
  const written = [];
  // core.autocrlf=true (Windows default) would check the hooks out with CRLF, and `sh` breaks on \r.
  const attributes = join(top, DISPATCH_DIR, '.gitattributes');
  if (!existsSync(attributes) || readFileSync(attributes, 'utf8') !== '* text eol=lf\n') {
    mkdirSync(join(top, DISPATCH_DIR), { recursive: true });
    writeFileSync(attributes, '* text eol=lf\n');
    written.push('.gitattributes');
  }
  for (const phase of PHASES) {
    const ours = readFileSync(join(pkgDir, 'githooks', phase), 'utf8');
    const file = join(top, DISPATCH_DIR, phase);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current !== ours && (current === null || versionOf(ours) >= versionOf(current))) {
      mkdirSync(join(top, DISPATCH_DIR), { recursive: true });
      writeFileSync(file, ours);
      written.push(phase);
    }
    // git ignores hooks without +x on Linux/macOS; npm tarballs and Windows checkouts drop the bit.
    chmodSync(file, 0o755);
  }
  return written;
}

/** core.hooksPath values an aquila package set before 0.2.0 (relative to the project, wrong in subfolders). */
export const isLegacyHooksPath = (value) =>
  /(^|\/)(\.aquila\/githooks|node_modules\/aquila(?:-[\w-]+)?\/githooks)\/?$/.test(value);

export const isDispatcher = (text) => /aquila-hooks dispatcher v\d+/.test(text);
