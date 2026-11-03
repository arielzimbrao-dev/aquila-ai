// Monorepo / project in a subfolder: hooks, core.hooksPath, CI workflow and git exclude must be anchored at the
// repository root, and several aquila packages (aquila-ai, aquila-react-ai, aquila-next-ai) share one hook
// dispatcher (.aquila-hooks/). The commits below run the real hooks through git's own `sh` (Git Bash on
// Windows, /bin/sh on Linux/macOS).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { aquila, cleanup, editConfig, git, LINK_TYPE, PKG } from './helpers.mjs';

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const MARK = "require('fs').appendFileSync(require('path').join(process.cwd(), '..', 'hooks.log'), process.argv[2] + '\\n');";

function repo() {
  const top = mkdtempSync(join(tmpdir(), 'aquila-mono-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: top });
  git(top, 'config', 'user.email', 'test@example.com');
  git(top, 'config', 'user.name', 'test');
  git(top, 'config', 'core.autocrlf', 'false');
  return top;
}

/** NestJS project with aquila-ai linked in <top>/<dir>/node_modules and gates that record their phase. */
function nest(top, dir) {
  const root = join(top, dir);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(PKG, join(root, 'node_modules', 'aquila-ai'), LINK_TYPE);
  write(root, 'package.json', JSON.stringify({
    dependencies: { '@nestjs/core': '^11.0.0' },
    devDependencies: { 'aquila-ai': '^0.2.0' },
    scripts: { test: 'node mark.js test' },
  }));
  write(root, 'mark.js', MARK.replace("'..'", `'${dir === '.' ? '.' : '..'}'`));
  write(root, 'src/app.ts', 'export {};\n');
  return root;
}

const nestGates = (root, name) => {
  editConfig(root, (cfg) => {
    cfg.gates = { mark: `node mark.js ${name}` };
    cfg.hooks = { 'pre-commit': ['mark'], 'pre-push': ['mark'], ci: ['mark'] };
  });
  assert.equal(aquila(root, 'sync').code, 0);
};

/**
 * A sibling package (aquila-react-ai) as its own `init` leaves things: its bin in frontend/node_modules, the
 * shared dispatcher (byte-identical, shipped by every aquila package) and its line in the registry.
 */
function reactSibling(top) {
  const bin = join(top, 'frontend', 'node_modules', 'aquila-react-ai', 'bin', 'aquila.mjs');
  write(top, 'frontend/src/App.tsx', 'export {};\n');
  write(top, 'frontend/package.json', '{}');
  mkdirSync(dirname(bin), { recursive: true });
  writeFileSync(
    bin,
    [
      "import { appendFileSync } from 'node:fs';",
      "import { join } from 'node:path';",
      "appendFileSync(join(process.cwd(), '..', 'hooks.log'), `frontend ${process.argv.slice(2).join(' ')}\\n`);",
      '',
    ].join('\n'),
  );
  for (const phase of ['pre-commit', 'pre-push']) {
    write(top, `.aquila-hooks/${phase}`, read(PKG, `githooks/${phase}`));
    chmodSync(join(top, `.aquila-hooks/${phase}`), 0o755); // git ignores non-executable hooks on Linux/macOS
  }
  write(top, '.aquila-hooks/projects', '# <package> <dir>\naquila-react-ai frontend\n');
  git(top, 'config', 'core.hooksPath', '.aquila-hooks');
}

const commit = (top, ...paths) => {
  for (const path of paths) write(top, path, `${Date.now()}${Math.random()}\n`);
  rmSync(join(top, 'hooks.log'), { force: true });
  const r = spawnSync('git', ['add', '-A'], { cwd: top });
  assert.equal(r.status, 0);
  const c = spawnSync('git', ['commit', '-q', '-m', paths.join(' ')], { cwd: top, encoding: 'utf8' });
  assert.equal(c.status, 0, `${c.stdout}${c.stderr}`);
  return existsSync(join(top, 'hooks.log')) ? read(top, 'hooks.log').trim().split('\n').sort() : [];
};

const unlinkAll = (top) => {
  for (const dir of ['.', 'backend', 'api'])
    for (const fn of [unlinkSync, rmdirSync])
      try {
        fn(join(top, dir, 'node_modules', 'aquila-ai'));
        break;
      } catch {}
  rmSync(top, { recursive: true, force: true });
};

test('project at the repository root: dispatcher, registry "aquila-ai .", commit runs the gate', () => {
  const top = repo();
  try {
    const root = nest(top, '.');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    nestGates(root, 'root');
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
    assert.match(read(top, '.aquila-hooks/projects'), /^aquila-ai \.$/m);
    assert.ok(!existsSync(join(root, '.aquila/githooks')), 'hooks no longer live in .aquila');
    assert.ok(existsSync(join(top, '.github/workflows/aquila-gates.yml')));
    assert.match(read(top, '.git/info/exclude'), /^\/AGENTS\.md$/m);
    assert.deepEqual(commit(top, 'src/app.ts'), ['root']);
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    unlinkAll(top);
  }
});

test('project in repo/backend: hooks, hooksPath, CI workflow and exclude anchored at the repo root', () => {
  const top = repo();
  try {
    const root = nest(top, 'backend');
    const init = aquila(root, 'init', '--tools=claude,codex', '--lint=off');
    assert.equal(init.code, 0, init.out);
    nestGates(root, 'backend');

    // 1–3: one dispatcher at the root, project registered by its path from the root.
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
    assert.match(read(top, '.aquila-hooks/projects'), /^aquila-ai backend$/m);
    // core.autocrlf=true (Windows default) would check the hooks out with CRLF, which breaks `sh`.
    assert.equal(read(top, '.aquila-hooks/.gitattributes'), '* text eol=lf\n');
    for (const phase of ['pre-commit', 'pre-push']) {
      assert.equal(read(top, `.aquila-hooks/${phase}`), read(PKG, `githooks/${phase}`));
      if (process.platform !== 'win32')
        assert.ok(statSync(join(top, `.aquila-hooks/${phase}`)).mode & 0o111, `${phase} executable`);
    }

    // 4: workflow where GitHub reads it, scoped to the folder.
    assert.ok(!existsSync(join(root, '.github/workflows/aquila-gates.yml')), 'never inside the subfolder');
    const wf = read(top, '.github/workflows/aquila-gates-backend.yml');
    assert.match(wf, /working-directory: 'backend'/);
    assert.match(wf, /paths:\n\s+- 'backend\/\*\*'/);
    assert.match(wf, /cache-dependency-path|node-version/);

    // 5: exclude entries prefixed with the project path.
    const exclude = read(top, '.git/info/exclude');
    assert.match(exclude, /^\/backend\/AGENTS\.md$/m);
    assert.match(exclude, /^\/backend\/CLAUDE\.md$/m);
    assert.doesNotMatch(exclude, /^\/AGENTS\.md$/m);
    assert.equal(git(top, 'status', '--porcelain', '--', 'backend/AGENTS.md', 'backend/CLAUDE.md'), '');

    // 1: the commit hook finds backend/node_modules and runs the gate there.
    assert.deepEqual(commit(top, 'backend/src/app.ts'), ['backend']);
    assert.deepEqual(commit(top, 'README.md'), [], 'changes outside backend/ run nothing');

    const check = aquila(root, 'check');
    assert.equal(check.code, 0, check.out);
    const doctor = aquila(root, 'doctor').out;
    assert.match(doctor, /subfolder backend\/ of the git repository/);
    assert.match(doctor, /✓ git hooks: \.aquila-hooks \(dispatcher; this project registered; bin found\)/);
    assert.match(doctor, /✓ CI workflow: \.github\/workflows\/aquila-gates-backend\.yml/);
  } finally {
    unlinkAll(top);
  }
});

test('init twice is idempotent: one registry line, one exclude block, nothing to sync', () => {
  const top = repo();
  try {
    const root = nest(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    const before = ['.aquila-hooks/projects', '.aquila-hooks/pre-commit', '.git/info/exclude'].map((f) => read(top, f));
    assert.equal(aquila(root, 'init').code, 0);
    const after = ['.aquila-hooks/projects', '.aquila-hooks/pre-commit', '.git/info/exclude'].map((f) => read(top, f));
    assert.deepEqual(after, before);
    assert.equal(read(top, '.aquila-hooks/projects').match(/aquila-ai backend/g).length, 1);
    assert.equal(read(top, '.git/info/exclude').match(/# >>> aquila-ai/g).length, 1);
    assert.equal(aquila(root, 'sync').out.trim(), '✓ adapters already in sync');
  } finally {
    unlinkAll(top);
  }
});

test('backend (aquila-ai) + frontend (aquila-react-ai) share the dispatcher; each runs only on its changes', () => {
  const top = repo();
  try {
    reactSibling(top); // the React package was set up first
    const root = nest(top, 'backend');
    const init = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(init.code, 0, init.out);
    assert.doesNotMatch(init.out, /a hook manager already exists/, 'reuses the dispatcher instead of competing');
    nestGates(root, 'backend');
    const projects = read(top, '.aquila-hooks/projects');
    assert.match(projects, /^aquila-react-ai frontend$/m, "the sibling's line is kept");
    assert.match(projects, /^aquila-ai backend$/m);
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'baseline');

    assert.deepEqual(commit(top, 'backend/src/app.ts'), ['backend']);
    assert.deepEqual(commit(top, 'frontend/src/App.tsx'), ['frontend gate pre-commit']);
    assert.deepEqual(commit(top, 'backend/src/app.ts', 'frontend/src/App.tsx'), ['backend', 'frontend gate pre-commit']);

    // pre-push dispatches on the commits being pushed (not on the index).
    const remote = mkdtempSync(join(tmpdir(), 'aquila-remote-'));
    try {
      execFileSync('git', ['init', '-q', '--bare', remote]);
      git(top, 'remote', 'add', 'origin', remote);
      assert.equal(spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: top }).status, 0);
      commit(top, 'frontend/src/App.tsx');
      rmSync(join(top, 'hooks.log'), { force: true });
      const push = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: top, encoding: 'utf8' });
      assert.equal(push.status, 0, `${push.stdout}${push.stderr}`);
      assert.deepEqual(read(top, 'hooks.log').trim().split('\n'), ['frontend gate pre-push']);
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }

    const doctor = aquila(root, 'doctor').out;
    assert.match(doctor, /2 aquila projects share \.aquila-hooks: aquila-ai backend, aquila-react-ai frontend/);
  } finally {
    unlinkAll(top);
  }
});

test('the hook fails with a clear message when a project has changes but its package is not installed', () => {
  const top = repo();
  try {
    reactSibling(top);
    rmSync(join(top, 'frontend', 'node_modules'), { recursive: true });
    write(top, 'frontend/src/App.tsx', 'changed\n');
    git(top, 'add', '-A');
    const c = spawnSync('git', ['commit', '-q', '-m', 'x'], { cwd: top, encoding: 'utf8' });
    assert.notEqual(c.status, 0);
    assert.match(`${c.stdout}${c.stderr}`, /frontend\/node_modules\/aquila-react-ai\/bin\/aquila\.mjs not found/);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test('check fails when the hook path or the workflow are somewhere git/GitHub never read', () => {
  const top = repo();
  try {
    const root = nest(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    assert.equal(aquila(root, 'check').code, 0);

    // 0.1.0 layout: hooksPath relative to the subfolder — git resolves it from the root and finds nothing.
    git(top, 'config', 'core.hooksPath', '.aquila/githooks');
    const hooks = aquila(root, 'check');
    assert.equal(hooks.code, 1, hooks.out);
    assert.match(hooks.out, /core\.hooksPath \.aquila\/githooks: no hooks there \(git resolves it from the repository root\) → npx aquila-ai init/);
    assert.equal(aquila(root, 'init').code, 0, 'init migrates it');
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');

    // Project missing from the registry: the dispatcher would skip it.
    write(top, '.aquila-hooks/projects', '# <package> <dir>\n');
    const unregistered = aquila(root, 'check');
    assert.equal(unregistered.code, 1);
    assert.match(unregistered.out, /backend is not in \.aquila-hooks\/projects/);
    assert.equal(aquila(root, 'init').code, 0);

    // 0.1.0 workflow inside the subfolder: GitHub never runs it.
    const stray = read(top, '.github/workflows/aquila-gates-backend.yml');
    write(root, '.github/workflows/aquila-gates.yml', stray);
    const wf = aquila(root, 'check');
    assert.equal(wf.code, 1, wf.out);
    assert.match(wf.out, /backend\/\.github\/workflows\/aquila-gates\.yml: GitHub only runs workflows from the repository root/);
    const sync = aquila(root, 'sync');
    assert.match(sync.out, /✓ removed backend\/\.github\/workflows\/aquila-gates\.yml/);
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    unlinkAll(top);
  }
});

test('CI `when` filters compare paths relative to the project, not the repository root', () => {
  const top = repo();
  try {
    const root = nest(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    editConfig(root, (cfg) => {
      cfg.gates = { scoped: { cmd: 'node -e 0', when: ['src/**'] } };
      cfg.hooks = { ci: ['scoped'] };
    });
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'base');
    const base = git(top, 'rev-parse', 'HEAD');
    write(root, 'src/app.ts', 'changed\n');
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'head');
    const head = git(top, 'rev-parse', 'HEAD');
    const event = join(top, 'event.json');
    writeFileSync(event, JSON.stringify({ before: base, after: head }));
    const r = spawnSync(process.execPath, [join(PKG, 'bin', 'aquila.mjs'), 'gate', 'ci'], {
      cwd: root,
      env: { ...process.env, AQUILA_ROOT: root, GITHUB_EVENT_PATH: event, GITHUB_SHA: head },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /✓ scoped/, 'backend/src/app.ts matches src/** of the backend project');
  } finally {
    unlinkAll(top);
  }
});
