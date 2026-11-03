# Changelog

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
