# NestJS conventions

How agents write NestJS code under aquila-ai. Project rules win (`docs/ai/`, `.github/instructions/`,
golden files — [`golden-files.md`](golden-files.md)); this file is the default when the project is silent.
Open a reference file only for the area the task touches.

## 1. Version first

1. Read the installed major: `@nestjs/core` in `package.json` (resolve ranges against the lockfile or
   `node_modules/@nestjs/core/package.json`). The generated `AGENTS.md` states it (`NestJS <major>`, refreshed by
   `npx aquila-ai sync`); the installed package still wins on conflict ([`precedence.md`](precedence.md)).
2. Apply the rules of that major from [`nestjs/versions.md`](nestjs/versions.md). Never use an API newer than
   the project's version; never "upgrade while passing by" — a major bump is its own task (ADR + plan).
3. Version-specific syntax to check every time: route/middleware wildcards (v11+), Express query parser
   (v11+), cache store (v11+), Standard Schema / ESM (v12+).
4. Docs: <https://docs.nestjs.com/> is the current major; older majors live under `/v10/`, `/v11/`, …

## 2. Checklist (default rules)

**Layout & naming** — [`nestjs/architecture.md`](nestjs/architecture.md)
- One feature = one folder with `x.module.ts`, `x.controller.ts`, `x.service.ts`, `dto/`, `entities/`,
  `x.service.spec.ts`; kebab-case files, PascalCase classes with suffix (`UsersService`).
- Generate with the CLI (`nest g resource|module|service`) when the project uses it; match its output.

**Modules & DI**
- A module exports only what other modules need; import the module, never re-provide its providers.
- Inject through constructors; inject tokens (`@Inject(TOKEN)`) for non-class providers; no `new` of
  injectables, no service locator (`moduleRef.get`) in business code.
- `@Global()` only for true cross-cutting infra (config, logger, db). Feature modules are not global.
- Circular dependency = design smell: extract a third module/provider or use events first; `forwardRef()`
  is the last resort, on both sides, with a comment why.
- Default scope is singleton. `Scope.REQUEST` bubbles up the whole injection chain and creates instances per
  request — avoid; prefer passing context explicitly or `AsyncLocalStorage`
  ([docs](https://docs.nestjs.com/fundamentals/injection-scopes#performance)).

**HTTP layer** — [`nestjs/http.md`](nestjs/http.md)
- Controllers are thin: parse/validate → call one service method → return. No business rules, no ORM.
- Every body/query/param input is a DTO validated by `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`) or, on v12+, a Standard Schema via `@Body({ schema })` — follow the project's existing choice.
- Responsibilities: middleware = raw req/res; guards = may this run? (authz); interceptors = wrap
  (map/timeout/cache/logging); pipes = transform/validate args; filters = shape errors.
- Order: middleware → guards → interceptors (before) → pipes → handler → interceptors (after) → filters.
- Throw `HttpException` subclasses (`NotFoundException`, …) at the HTTP edge; domain code throws domain
  errors mapped by a filter. Never swallow errors; never leak stack traces or internals in responses.
- Serialize responses explicitly (response DTOs, `ClassSerializerInterceptor` + `@Exclude()`), never return
  ORM entities with secrets.

**Config, security, ops** — [`nestjs/security-config.md`](nestjs/security-config.md)
- `ConfigModule.forRoot({ isGlobal: true, validate | validationSchema })`; fail fast on bad env;
  `registerAs` namespaces; read env only in config files ([`quality.md`](quality.md) `configPaths`).
- `helmet`, explicit CORS allow-list, `@nestjs/throttler`, auth via guards (`APP_GUARD` + `@Public()` opt-out).
- Logging via `Logger`/`ConsoleLogger` (JSON in production) or the project's logger; no `console.log`.
- `app.enableShutdownHooks()` and release resources in `onModuleDestroy`/`onApplicationShutdown`.
- Health checks with `@nestjs/terminus`. OpenAPI with `@nestjs/swagger` (CLI plugin) when the project
  exposes docs.

**Testing** — [`nestjs/testing.md`](nestjs/testing.md)
- Unit: `Test.createTestingModule` + `overrideProvider`/`useValue` mocks; test the class, not Nest.
- E2E: boot the real `AppModule` (override only external I/O), apply the same global pipes/filters as
  `main.ts`, drive it with `supertest`, `await app.close()` in `afterAll`.
- Tests come first (failing) per [`workflow.md`](workflow.md).

## 3. Review red flags

- API or syntax newer than the project's Nest major; unnamed `*` wildcard on v11+.
- Business logic in controllers, guards or interceptors; ORM entity returned as response.
- Provider re-declared in a second module instead of imported; new `forwardRef` without justification.
- New `Scope.REQUEST` provider on a hot path; `process.env` read outside config.
- DTO without validation decorators/schema; global pipe options in tests differ from `main.ts`.
- Missing `await app.close()` in e2e; caught error not rethrown or mapped.
