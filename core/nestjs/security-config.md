# NestJS config, security and operations

Entry: [`../nestjs.md`](../nestjs.md). Version deltas: [`versions.md`](versions.md).

## Configuration ([docs](https://docs.nestjs.com/techniques/configuration))

- `ConfigModule.forRoot({ isGlobal: true, cache: true, load: [appConfig, dbConfig], validate })` once in
  the root module.
- Validate env at boot and fail fast: `validate` (class-validator / any function) or `validationSchema`
  (Joi; v12 also Standard Schema — Zod/Valibot/ArkType; Joi needs v18+ with options under
  `validationOptions.libraryOptions`).
- Group by namespace with `registerAs` and inject typed:

```ts
export const dbConfig = registerAs('db', () => ({ url: process.env.DATABASE_URL }));
constructor(@Inject(dbConfig.KEY) private readonly db: ConfigType<typeof dbConfig>) {}
```

- `process.env` only inside config files and `main.ts` ([`../quality.md`](../quality.md) `configPaths`).
- Async module setup reads config via `forRootAsync({ inject: [ConfigService], useFactory })` or
  `dbConfig.asProvider()`.
- `configService.get<T>('key', { infer: true })` with a typed `ConfigService<Env, true>`; handle absence
  instead of `!`.
- v11 (`@nestjs/config` 4): `get` order is namespaces/`load` → validated env → `process.env`;
  `skipProcessEnv: true` to forbid raw env reads.

## Secrets

- Secrets come from the environment / secret manager, never from committed files; `.env` is gitignored and
  `.env.example` lists keys without values.
- Never log config objects, tokens, passwords or full request bodies; redact before logging.
- Don't return secrets in responses (serializer `@Exclude()`), errors or OpenAPI examples.

## HTTP hardening

- Helmet ([docs](https://docs.nestjs.com/security/helmet)): `app.use(helmet())` (Express) or
  `app.register(helmet)` from `@fastify/helmet`; register before routes/other `app.use`. Adjust CSP if
  Swagger UI is served.
- CORS ([docs](https://docs.nestjs.com/security/cors)): `app.enableCors({ origin: [allow-list], credentials })`
  from config; never `origin: '*'` with credentials. Fastify 5 (v11+): list non-safelisted `methods`.
- Rate limiting ([docs](https://docs.nestjs.com/security/rate-limiting)): `@nestjs/throttler` with
  `ThrottlerModule.forRoot([{ ttl: seconds(60), limit: 100 }])` (v5+: `ttl` in **ms**, array of named
  throttlers) + `{ provide: APP_GUARD, useClass: ThrottlerGuard }`; tighter `@Throttle({ default: {…} })` on
  login/OTP; shared storage (e.g. Redis) when running more than one instance.
- Behind a proxy set trust proxy (`app.set('trust proxy', …)` / `FastifyAdapter({ trustProxy })`) so client
  IPs are real; on Fastify ≥ 5.12.1 pass addresses, not a hop count (docs warning).
- Body size limits via the adapter (`bodyParser` / `useBodyParser`) for upload-heavy routes; validate files
  with `ParseFilePipe` validators.
- CSRF only for cookie-based auth ([docs](https://docs.nestjs.com/security/csrf)).

## Authentication & authorization ([authn](https://docs.nestjs.com/security/authentication), [authz](https://docs.nestjs.com/security/authorization))

- Secure by default: global auth guard via `APP_GUARD`; opt out with a `@Public()` metadata decorator read
  by the guard through `Reflector`.
- JWT: `@nestjs/jwt` (`JwtModule.registerAsync` with secret from config, explicit `expiresIn`) — or Passport
  (`@nestjs/passport` + `passport-jwt` strategy + `AuthGuard('jwt')`) if the project uses it.
- Roles/permissions in a separate guard after authentication (`@Roles()` via `Reflector.createDecorator`,
  v10.2+); ownership checks (user can only touch own resource) belong in the service, not only the guard.
- Hash passwords with `bcrypt`/`argon2`; never compare secrets with `===` on raw values (use constant-time
  compare); return 401 vs 403 correctly; don't reveal whether a user exists on login.
- Expose the current user through a custom param decorator (`@CurrentUser()`), not `req.user` everywhere.

## Logging ([docs](https://docs.nestjs.com/techniques/logger))

- `private readonly logger = new Logger(XService.name)`; never `console.log`.
- Production: JSON — `new ConsoleLogger({ json: true })` (v11+) or the project's logger (e.g. pino via
  `nestjs-pino`) with `bufferLogs: true` + `app.useLogger(app.get(Logger))`.
- v12: structured params on by default — `logger.log('User created', { userId })` lands under `params`.
- Every log line carries the correlation id (middleware/interceptor + `AsyncLocalStorage`); log errors once
  with the stack, at the filter/boundary that handles them.

## Graceful shutdown ([docs](https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown))

- `app.enableShutdownHooks()` in `main.ts` (off by default; registers SIGTERM/SIGINT listeners).
- Close DB pools, consumers, schedulers in `onModuleDestroy`/`onApplicationShutdown`; stop accepting work
  first, then drain. v12 Express adapter drains in-flight requests itself.
- Don't depend on hook order across modules (changed in v11 and v12 — [`versions.md`](versions.md)).

## Health checks ([docs](https://docs.nestjs.com/recipes/terminus))

- `@nestjs/terminus`: `HealthCheckService` + built-in indicators (`TypeOrmHealthIndicator`,
  `HttpHealthIndicator`, `MemoryHealthIndicator`, `DiskHealthIndicator`) in a `HealthController` marked
  `@Public()` and skipped by the throttler.
- Separate liveness (process up, no dependencies) from readiness (DB, broker reachable).
- Custom indicators: v11+ inject `HealthIndicatorService` and use `check(key).up()/down()`; v12 removed the
  legacy `HealthIndicator`/`HealthCheckError` (use `.withTimeout()` instead of `timeout`).
