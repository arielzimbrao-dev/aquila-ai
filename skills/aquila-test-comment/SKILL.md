---
name: aquila-test-comment
description: >-
  Writes the "How to test" comment for non-dev QA (Markdown for the tracker) from the ticket and the code. Use for "how to test", "/aquila-test-comment".
model: haiku
---

# aquila-test-comment — "How to test" for QA

Project data (tracker, API collection, environment, database, correlation header): the `qa` block of
`docs/ai/aquila.json`; if missing, ask once and propose adding it. `qa.tracker` decides the format:
Jira Cloud, GitHub/GitLab and Azure DevOps accept Markdown; the Jira notes below apply only to Jira.
Project without an API (frontend, library): steps are actions in the app/environment and what is seen,
instead of calls and queries.

## Audience — golden rules

- **Non-dev QA**: plain language; start by explaining "what it is" in words.
- QA has **only** the repo's API collection and **read-only** database access. They do not touch code.
- Output **always in Markdown**, inside a ` ````markdown ` block (four backticks, so the inner ` ```sql `
  blocks do not close it). Jira Cloud does not read wiki markup (`h3.`, `{code}`).
- **Simple but complete**: happy path + idempotency/edge cases + expected result + evidence.
- Calls and queries **ready to paste**, with real example ids from the repo.
- A unique correlation id per run (header `qa.correlationHeader`; confirm in the code the accepted
  format — e.g. UUID — and whether it is returned in the response).
- Separate what is **not for QA to validate** and **known non-bugs** (flag off, pending provisioning)
  into `> ⚠️` / `> ℹ️` quotes.

## Before writing

1. Read the ticket: goal, acceptance criteria, risks.
2. Read the task's code (diff): routes, tables/columns, events, feature flags, config. **Never invent
   identifiers** — confirm each one in the code.
3. Map each acceptance criterion to a verifiable step. No endpoint → generate data through another call
   and query it, or use direct queries.

## Structure (in this order)

````markdown
### How to test — <ID>: <short name>

**What it is:** <1–2 plain sentences>.

#### Setup

- Environment: **<qa.environment>**. Collection: **<qa.apiCollection>** → folder **<folder>**.
- Header `<qa.correlationHeader>`: <value/format>; copy the returned value into the queries.
- Database: <qa.database>.

> ⚠️ **Before starting:** confirm with dev/ops that these are on: `<FLAGS>`, and <preconditions>.

#### Steps

1. **<Request 1>** (<example id>) → <expected status>.
2. **<Request 2>** → <expected status>.

#### Check in the database

```sql
SELECT <columns> FROM <table> WHERE <correlation or known id>;
```

**Expected:** <concrete result>.

#### Idempotency / edge cases

<what to resend/try and what must still happen>.

> ℹ️ **Not bugs:**
>
> - <known non-bug>.

#### Evidence to capture

- Screenshot of query <…> showing <expected state>.
````

## Content rules

- Always state **what "passed" means** — a concrete result, never "check that it is ok".
- One query per block; placeholders only for QA's own values (`<date>`).
- Jira Markdown: `###`/`####`, `**bold**`, `` `code` ``, `1.`/`-` lists, warnings with `>`; `→`
  arrows; avoid tables.
