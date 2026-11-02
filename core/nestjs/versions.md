# NestJS versions — what changes when writing code

Detect the major first ([`../nestjs.md`](../nestjs.md) §1). Only the deltas that change how code is
written are listed; upgrades themselves follow the official guide for the target major.

## 8 → 9 ([guide](https://docs.nestjs.com/v9/migration-guide))

- Node 10 dropped. Fastify 4: plugins are `@fastify/*` (e.g. `@fastify/cookie`).
- Redis transport uses `ioredis` with `host`/`port` options (not `url`).
- Kafka handlers receive the unwrapped `value`; raw message via `KafkaContext`.
- `listenAsync()` and other deprecated APIs removed — use `listen()`.
- New in 9: `ConfigurableModuleBuilder`, REPL, durable providers.

## 9 → 10 ([guide](https://docs.nestjs.com/v10/migration-guide))

- Node ≥ 16; packages compiled to ES2021; Swagger/GraphQL CLI plugins need TypeScript ≥ 4.8.
- `CacheModule` moved from `@nestjs/common` to `@nestjs/cache-manager`.
- Log level numbers: `verbose` = 0, `debug` = 1 (matters only for custom level math).
- All previously deprecated APIs removed.

## 10 → 11 ([guide](https://docs.nestjs.com/v11/migration-guide), [release](https://github.com/nestjs/nest/releases/tag/v11.0.0))

- **Node ≥ 20.** Express 5 and Fastify 5 are the defaults.
- **Route paths (Express 5 / path-to-regexp 8):** wildcards must be named — `/*` → `/*splat`, or
  `/{*splat}` to also match the root; optional segments use braces (`/:file{.:ext}`), not `?`; no inline
  regexp; reserved characters must be escaped. Middleware: `forRoutes('*')` → `forRoutes('{*splat}')`.
  A legacy path converter softens old syntax, but write the new one.
- **Express query parser** defaults to `simple` (no nested objects/arrays). Need `a[b]=1`? Opt in with
  `app.set('query parser', 'extended')` explicitly.
- **Fastify 5:** middleware `(.*)` → named wildcard; CORS allows only safelisted methods unless `methods`
  lists PUT/PATCH/DELETE.
- **Shutdown hooks** (`onModuleDestroy`, `beforeApplicationShutdown`, `onApplicationShutdown`) run in reverse
  init order; global modules init first, destroy last. Middleware of global modules runs first.
- **Cache:** `@nestjs/cache-manager` v3 uses Keyv stores (`stores: [new KeyvRedis(url)]` from `@keyv/redis`);
  stored entries are `{ value, expires }`.
- **`@nestjs/config` 4:** `get()` reads internal config (namespaces/`load`) → validated env → `process.env`.
  `ignoreEnvVars` deprecated → `validatePredefined`; `skipProcessEnv` stops reading `process.env`.
- **Reflector:** `getAllAndOverride` returns `T | undefined` (handle `undefined`); `getAllAndMerge` with one
  object entry returns the object, not a one-element array.
- **Module identity:** dynamic modules are compared by object reference, not hash. Reuse one instance by
  storing `XModule.forRoot(...)` in a const; in tests duplicates may need `module.get(T, { each: true })` or
  `moduleIdGeneratorAlgorithm: 'deep-hash'`.
- `@Inject()` accepts narrower token types; promises in module `exports` no longer supported.
- New: `ConsoleLogger({ json: true })`, `ParseDatePipe`, `IntrinsicException` (not logged by the framework).
  `plainToClass` → `plainToInstance`.
- Terminus: `HealthIndicatorService` replaces `HealthIndicator`/`HealthCheckError` (deprecated).

## 11 → 12 ([guide](https://docs.nestjs.com/migration-guide), [release](https://github.com/nestjs/nest/releases/tag/v12.0.0))

Released (tag `v12.0.0`, dated 27 Aug; the release page omits the year — 2026 per secondary sources). Upgrade with `nest upgrade` (`--dry-run` first).

- **Node:** run apps on 20.19+ or 22.12+ (21.x unsupported). CLI/schematics need 22.22.3+, 24.15+ or 26+.
  Schematics v12 peer-depend on TypeScript 6.
- **ESM:** core packages ship as ESM; CommonJS apps keep working via `require(esm)`. Converting the app to
  ESM is optional — don't do it as a side effect. `nest new` asks CJS vs ESM.
- **Tests:** Vitest is the default for new ESM projects; CJS projects stay on Jest, which needs Node 24.9+
  to load the ESM-only packages (guide). AWS Lambda CJS: `NODE_OPTIONS=--experimental-require-module`.
- **Standard Schema:** `@Body/@Query/@Param/@RawBody({ schema })` + `StandardSchemaValidationPipe`
  (Zod/Valibot/ArkType); `StandardSchemaSerializerInterceptor` for responses. class-validator +
  `ValidationPipe` remain supported (no removal planned). `ValidationPipe({ errorFormat: 'list' | 'grouped' })`.
- **Lifecycle hooks** run by component hierarchy level — don't rely on cross-module hook order.
- **`@Optional()`:** a subclass that redeclares its constructor must redeclare `@Optional()` (12.1 restores
  inheritance only when the subclass has no constructor).
- **Routing:** routes register in declaration order — declare `@Get('me')` before `@Get(':id')`. Opt-in
  `routeConflictPolicy`/`routeResolutionStrategy` (default = v11 behavior).
- **Pipes:** stricter `transform` signatures; `ArgumentMetadata` is generic — recheck custom pipes.
- **Config:** `validationSchema` accepts Standard Schema; Joi needs v18+, its options move to
  `validationOptions.libraryOptions`.
- **Terminus:** legacy `HealthIndicator`/`HealthCheckError` removed — use `HealthIndicatorService`
  (`up()/down()/attempt()`), `.withTimeout()` instead of `timeout`.
- **Logger:** `ConsoleLogger` structured params on by default (`logger.log('msg', { id })` → `params`);
  `structuredParams: false` restores old output.
- **Errors:** `HttpExceptionOptions.errorCode` for machine-readable codes; HTTP adapter error mapping reworked;
  Express adapter drains in-flight requests on shutdown.
- **Microservices/GraphQL:** NATS v3 (`@nats-io/transport-node`, no `StringCodec`/`JSONCodec`);
  `subscriptions-transport-ws` removed → `graphql-ws`; GraphiQL default IDE.
- **CLI:** `--webpack` deprecated → `--builder rspack`; `angular` schematic removed.

## Do / don't by project version

| Project on | Do | Don't |
|---|---|---|
| ≤ 9 | `@nestjs/common` `CacheModule` (≤ 9 only); `ioredis` for Redis transport (9) | `ConfigurableModuleBuilder` on 8; any v10+ package |
| 10 | `@nestjs/cache-manager` (v2 API); `path-to-regexp` 0.x syntax (`/*`, `:id?`) | Keyv stores; `ConsoleLogger({ json })`; `ParseDatePipe` |
| 11 | Named wildcards `*splat`/`{*splat}`; braces for optional; Keyv cache; `HealthIndicatorService`; handle `T \| undefined` from Reflector | Unnamed `*`, `?` optional, inline regexp; `@Body({ schema })`; `StandardSchemaValidationPipe`; relying on nested query parsing without `extended` |
| 12 | Everything from 11; Standard Schema if the project adopts it; static routes before param routes; `errorCode` | Legacy `HealthIndicator`; `subscriptions-transport-ws`; `nats` v2 codecs; converting to ESM/Vitest unasked |

Unconfirmed in official sources: anything about v13; the exact Express/Fastify versions bundled with v12
(the v12 release notes don't state them; assume Express 5 / Fastify 5 as in v11).
