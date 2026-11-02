# NestJS testing — unit, integration, e2e

Entry: [`../nestjs.md`](../nestjs.md). Method: tests first, failing, per [`../workflow.md`](../workflow.md);
copy the golden unit/e2e test of the project ([`../golden-files.md`](../golden-files.md)).
Official guide: <https://docs.nestjs.com/fundamentals/testing>.

## Runner

- Use the project's runner and config (Jest on most CJS projects; Vitest is the v12 default for new ESM
  projects). Don't switch runners inside a feature task.
- v12 + Jest on CJS: Jest needs Node 24.9+ to load the ESM-only Nest packages
  ([guide](https://docs.nestjs.com/migration-guide)). If tests fail to import `@nestjs/*`, check Node first.
- Vitest + decorators: needs a transformer that emits decorator metadata (e.g. SWC with
  `decoratorMetadata`), or DI resolves `undefined` ([recipe](https://docs.nestjs.com/recipes/swc)).
- Files: `*.spec.ts` next to the source (unit), `test/*.e2e-spec.ts` (e2e) — the CLI defaults.

## Unit tests

- Pure classes (domain services, mappers, pipes, guards with explicit deps): instantiate with `new` and
  hand-written fakes — fastest, no Nest involved.
- Classes wired by DI: `Test.createTestingModule` with the class under test + mocks for every dependency:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn() } },
    { provide: PAYMENT_GATEWAY, useValue: { charge: jest.fn() } },
  ],
}).compile();
const service = moduleRef.get(UsersService);
```

- Mock at the boundary you own (repository, gateway token), not deep library internals.
- `useMocker(createMock)` (e.g. `@golevelup/ts-jest`) auto-mocks missing deps — use only if the project
  already does; explicit mocks document dependencies.
- Request-scoped/transient providers: `await moduleRef.resolve(X)`, not `get()`.
- Guards/interceptors: unit-test `canActivate`/`intercept` with a fake `ExecutionContext`; test metadata via
  a real `Reflector`.
- Assert behavior (return value, thrown exception type, calls on the boundary mock with arguments), not
  that private methods ran. Reset mocks between tests (`clearMocks` in config or `jest.clearAllMocks()`).

## Integration (module-level)

- Import the real feature module and override only external I/O:

```ts
Test.createTestingModule({ imports: [UsersModule] })
  .overrideProvider(MailService).useValue(fakeMail)
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
  .compile();
```

- Also available: `overrideInterceptor`, `overridePipe`, `overrideFilter`; `overrideModule` on newer
  versions (check the installed `@nestjs/testing`).
- Databases: prefer a real disposable instance (container or in-memory engine the project already uses)
  over mocking the ORM; clean state per test/suite.
- v11+: dynamic modules are compared by reference — duplicated `forRoot()` imports create separate
  instances; stub with `moduleRef.get(X, { each: true })` or dedupe the import
  ([v11 guide](https://docs.nestjs.com/v11/migration-guide)).

## E2E ([docs](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing))

```ts
let app: INestApplication;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ExternalApi).useValue(fakeApi)
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app); // same pipes/filters/versioning/prefix as main.ts
  await app.init();
});
afterAll(() => app.close());

it('rejects unknown fields', () =>
  request(app.getHttpServer()).post('/users').send({ email: 'a@b.c', admin: true }).expect(400));
```

- Extract `main.ts` setup (global pipes, filters, interceptors, prefix, versioning) into one
  `configureApp(app)` used by both, or register them as `APP_*` providers — otherwise e2e tests a
  different app than production.
- Use `request(app.getHttpServer())` from `supertest`; Fastify needs `await app.getHttpAdapter().getInstance().ready()`
  after `init()`.
- Cover per endpoint: happy path, validation failure (400), auth failure (401/403), not found (404), and at
  least one real flow end-to-end ([`../workflow.md`](../workflow.md) §2).
- Always `await app.close()` — open handles make the runner hang (`--detectOpenHandles` to find them).
- Don't call real third parties; override their client provider.

## Coverage & gates

- Coverage via the runner (`jest --coverage` / `vitest --coverage`); thresholds come from the project's
  config and gates, not from this file.
- Exclude `main.ts`, `*.module.ts`, DTOs without logic only if the project already does; never exclude
  services to hit a number.

## Mapping to the method

| Method step | Nest artifact |
|---|---|
| Test cases from the plan | One `describe` per behavior; titles state the rule |
| Failing tests first | Unit spec for the service/guard/pipe; e2e spec for each new route |
| Minimal code | Provider + DTO + controller method, registered in the module |
| Done checklist | Unit + e2e green, gates green, no `only`/`skip` |
