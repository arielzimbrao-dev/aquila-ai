# Changelog

## 0.3.0 — 2026-11-03

Fixes from installing the 0.2.0 family in real repositories (a NestJS backend and a React frontend in one repo, a
NestJS project in a subfolder, Next.js at the root, npm workspaces). aquila-ai, aquila-react-ai and
aquila-next-ai now come from one source: everything that is not technology-specific (CLI, hooks, CI, gates,
lint engine) is identical in the three; conventions, lint plugins and presets stay per stack. **Upgrade every
aquila package of a repository to 0.3.0 together.**

- **Hook dispatcher v2, one file for the three packages.** 0.2.0 shipped three incompatible dispatchers
  (different headers; aquila-next-ai wrote the registry as `<dir>\t<package>` and kept it out of git). The
  v2 header is recognized by every 0.2.0 version (none downgrades it); v1 copies are upgraded; a hand-written
  hook in `.aquila-hooks/` is left alone. The dispatcher reads both registry formats and finds the package
  hoisted to the repository root (npm/pnpm workspaces). `.aquila-hooks/projects` has one fixed header, keeps the
  other packages' lines as written and is sorted by folder, so the init order no longer matters.
- **Executable bit:** `init`/`sync` record `.aquila-hooks/pre-commit|pre-push` as `100755` in the index (Windows
  versioned them `100644`, so Linux/macOS clones never ran them); `check` fails when they are not.
- **core.hooksPath:** a custom path whose folder is gone or has no hooks is migrated to `.aquila-hooks` with a
  warning; a real manager (husky…) is kept, with the exact call to the dispatcher, or migrated with
  `init --hooks=dispatcher`. `check --ready` accepts `cd <dir> && npx <package> gate …` and
  `"$(git rev-parse --show-toplevel)/.aquila-hooks/<phase>"`.
- **CI:** `ci.workflow: false` (no generated workflow; `doctor` prints the steps for your pipeline and no longer
  reports it missing), `ci.services` / `ci.env` (e.g. Postgres, so `gate ci` runs the full suite). The workflow
  of a project in a subfolder also triggers on its own file.
- **Done ≠ CI:** `done.gates` lists the definition of done in `AGENTS.md` independently of `hooks.ci`.
- **init reads the project:** a lint/format script that fixes files (`--fix`, `--write`) is never a gate
  (`lint:check`/`lint:ci` preferred); coverage thresholds come from `jest.config`/`vite(st).config`/`package.json`;
  with a `coverage` gate CI no longer also runs `test`; the identifiers' language sets `language.code`
  (`--code-lang`); `--lang=pt-BR|pt-PT` writes the `docs/` indexes (adr, c4, tracks, reference, runbooks,
  skills) in that language; warns when no gate runs tests. aquila-next-ai: on Next.js ≥ 16 a `next lint` script
  becomes `npx eslint .`.
- **Lint:** `lint --baseline` (ESLint bulk suppressions in `docs/ai/lint-baseline.json`: only new violations
  fail), `lint --fix`, `lint.overrides` per rule in `aquila.json`. The lint plugins are optional
  `peerDependencies` with ranges that work together; `init` prints the exact install (`--install` runs it) and
  picks eslint-plugin-unicorn 65.0.1 for ESLint 9 / ≥ 66 for ESLint 10; `doctor` checks the versions. ESLint is
  found when hoisted; ESLint 8 (`.eslintrc`) and a TypeScript project without typescript-eslint are reported
  instead of failing on every file; a rule the installed plugin version lacks is skipped and reported.
  aquila-ai: `consistent-type-imports` never turns constructor-injected imports into `import type` (Nest DI
  would break at runtime). Each package loads only its own stack's plugins.
- **Commits:** the "commit/push only when asked" rule admits a standing instruction of the owner;
  `workflow.autoCommit: true` writes it into `AGENTS.md`.
- **PR size:** generated and managed files (`.aquila/`, `.aquila-hooks/`, routers, `.claude/commands/aquila-*`,
  `aquila-gates*.yml`, the lint baseline) don't count towards `review.prMaxFiles`.
- **Subfolder projects:** Copilot gets a root `.github/instructions/aquila-<folder>.instructions.md` scoped to
  the folder, and the root `.vscode/settings.json` points at the project's agents and skills.
- **Team mode** versions the `/aquila-*` commands (they were excluded from git yet committed in practice).
- **CLI:** `--help`/`-h` on every command; `check --verbose` (otherwise the files without per-folder
  instructions are a one-line count); `doctor` tells which folder to open Claude Code in when a repository
  has several aquila projects; the plugin is reported "not verified" (never "missing") when the `claude` CLI
  fails. `AGENTS.md` stays within its 3,500-character budget.
- Docs: README sections "Monorepo / project in a subfolder" and "Adopting in a legacy project", the same
  "The aquila family" section in the three READMEs. aquila-react-ai: `core/react.md` no longer prescribes
  TanStack Query/Zod/MSW/Playwright — the project's existing stack wins.

## 0.2.0 — 2026-11-03

Monorepo support: the project no longer has to be the git repository root, and several aquila packages
(aquila-ai, aquila-react-ai, aquila-next-ai) can live in the same repository.

- **Hooks:** a shared dispatcher in `<repo>/.aquila-hooks/` (`core.hooksPath = .aquila-hooks`, which git resolves
  from the repository root) with a registry `.aquila-hooks/projects` ("<package> <dir>"). Each `init` adds its
  line and reuses the dispatcher instead of competing for `core.hooksPath`. Hooks run
  `<dir>/node_modules/<package>/bin/aquila.mjs gate <phase>` only for projects with changes (staged files on
  pre-commit, pushed commits on pre-push) and fail with a clear message when a project's package isn't
  installed. `.aquila-hooks/.gitattributes` keeps them LF on Windows checkouts. Hooks no longer live in
  `.aquila/githooks`.
- **CI:** from a subfolder the workflow is written where GitHub reads it,
  `<repo>/.github/workflows/aquila-gates-<folder>.yml`, with `working-directory`, `paths` and
  `cache-dependency-path`; the 0.1.0 workflow inside the subfolder is removed by `sync`. CI `when` filters
  compare paths relative to the project.
- **git exclude:** local-mode entries are prefixed with the project folder (one block per project).
- **check / doctor:** `check` fails when `core.hooksPath` has no hooks, still uses the 0.1.0 layout, the project
  is missing from the registry, or a generated workflow sits in a subfolder. `doctor` shows the subfolder, the
  dispatcher (present, executable, project registered, bin found), the workflow and the other aquila
  projects in the repository. `check --ready` accepts the dispatcher and husky hooks that call it.
- **Migration:** `npm i -D aquila-ai@latest && npx aquila-ai init` moves `core.hooksPath` from
  `.aquila/githooks` or `node_modules/aquila-ai/githooks` to `.aquila-hooks`. Commit `.aquila-hooks/` and the
  workflow.
- README: "Monorepo / project in a subfolder" section and the sibling packages.

## 0.1.0 — 2026-11-02

- First open-source release as the `aquila-ai` npm package for NestJS projects, derived from a private
  AI-development method: CLI (`npx aquila-ai init|sync|check|doctor|gate|lint|tokens`), skills `/aquila-*`,
  roles plan/tests/implement/review, Claude Code plugin, Copilot and Codex adapters, ESLint quality levels,
  small-PR directive (`review.prMaxFiles`, default 30, `--pr-max-files`),
  self-contained GitHub Actions workflow and NestJS conventions (focus on NestJS 11 and 12).
