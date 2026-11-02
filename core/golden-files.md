# Golden files

One **real example per artifact type** (listener, domain service, adapter, repository, migration, unit
test, e2e test, …), registered in the project's `docs/ai/golden.md`. Before writing a new artifact, the
agent copies the **pattern** of the golden file of the same type — not the one next door, which may be a
class with 13 dependencies.

Each entry has the path and 2–3 lines on **why** it is the pattern (boundaries, transaction, tests). If a
golden file is renamed or grows beyond an example, replace it in the same task. `aquila-init` proposes
candidates; the dev validates.
