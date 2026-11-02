# Done checklist

Single copy. The **concrete commands** for each item live in the project's `docs/ai/aquila.json` (`gates`);
`npx aquila-ai gate ci` runs those selected in `hooks.ci` (all by default) and prints only failures and
totals.

- [ ] `typecheck` / build
- [ ] `test` — unit tests, all green
- [ ] `lint` — zero warnings (project lint + `lint-aquila` at the `lint.level` level; see
      [quality](quality.md))
- [ ] `format` — formatting checked
- [ ] `coverage` — the project command enforces the thresholds; the numbers in `docs/ai/aquila.json` →
      `coverage` document the contract (they appear in `AGENTS.md`) and are not enforced by aquila-ai;
      `coverage.enforced` says whether the project tool fails below them (jest `coverageThreshold`). Only
      real asserts count.
      Having a coverage gate does not prove equivalence with `test`: keep both, unless the team explicitly
      confirms they run the same tests and checks.
- [ ] `e2e` — evaluate when what connects the pieces changes: module wiring, routes and listeners. A
      `gates.e2e.when` glob list filters CI execution by changed paths; local hooks do not apply the filter.
- [ ] `npx aquila-ai check` — if docs changed: links, budgets, instructions, adapters
- [ ] generated docs regenerated and versioned (CI compares them)
- [ ] API collection/contract (Postman, OpenAPI…) in sync — if the API changed and the project maintains one
- [ ] `docs/c4/` updated — if files changed layer or the schema changed ([docs](docs.md))

Never declare done without all applicable items green. Never `--no-verify`.
