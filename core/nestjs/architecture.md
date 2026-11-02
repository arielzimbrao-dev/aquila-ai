# NestJS architecture — modules, DI, providers, lifecycle

Entry: [`../nestjs.md`](../nestjs.md). Version deltas: [`versions.md`](versions.md).

## Modules ([docs](https://docs.nestjs.com/modules))

- One module per feature/bounded context; `AppModule` only composes. Shared infra lives in its own module
  (`DatabaseModule`, `ConfigModule`), imported where used.
- `exports` is the module's public API: export the minimum (usually one service). Never list another module's
  provider in your `providers` — import the module that exports it.
- Re-export a module (`exports: [XModule]`) only when consumers always need it together.
- `@Global()` for a handful of infra modules registered once in the root; feature modules stay explicit.
- Same instance across importers: a provider is a singleton per module that declares it, not per importer.

## Providers & DI ([docs](https://docs.nestjs.com/providers), [custom](https://docs.nestjs.com/fundamentals/custom-providers))

- Constructor injection with `private readonly`; no property injection unless extending a base class.
- Depend on an abstraction only when there are (or will be in this task) two implementations; then use an
  injection token, not a TS interface (interfaces vanish at runtime):

```ts
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
providers: [{ provide: PAYMENT_GATEWAY, useClass: HttpPaymentGateway }]
constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}
```

- `useValue` for constants/mocks, `useClass` for swapping implementations, `useFactory` + `inject` for
  config-dependent construction (async factories are awaited before bootstrap ends), `useExisting` for aliases.
- Keep tokens in one `*.constants.ts`/`*.tokens.ts` per module; prefer `Symbol` or `InjectionToken` strings
  that are unique app-wide.
- `@Optional()` only when the code truly handles absence (v12: redeclare it on subclasses with their own
  constructor — [`versions.md`](versions.md)).
- Don't call `moduleRef.get()`/`resolve()` in business code; it hides dependencies. Acceptable in
  factories/plugins that must resolve dynamically.

## Circular dependencies ([docs](https://docs.nestjs.com/fundamentals/circular-dependency))

- First fix the design: extract the shared part into a third provider/module, or decouple with events
  (`@nestjs/event-emitter`) / CQRS.
- `forwardRef(() => X)` is the last resort, on both sides (`@Inject(forwardRef(() => X))` for providers,
  `imports: [forwardRef(() => XModule)]` for modules), with a comment. Instantiation order is then undefined
  — don't use the other side in the constructor.
- Barrel files (`index.ts`) re-exporting across modules are a frequent cause of `undefined` imports; import
  from the file directly inside module/provider declarations.

## Dynamic modules ([docs](https://docs.nestjs.com/fundamentals/dynamic-modules))

- Convention: `forRoot`/`forRootAsync` (configured once, app-wide), `register`/`registerAsync` (per
  importer), `forFeature` (per-feature slice of a root config).
- On v9+ build them with `ConfigurableModuleBuilder` instead of hand-writing the boilerplate:

```ts
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<MailOptions>().setClassMethodName('forRoot').build();
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule extends ConfigurableModuleClass {}
// MailService: constructor(@Inject(MODULE_OPTIONS_TOKEN) private opts: MailOptions) {}
```

- Async variant takes `imports`, `inject`, `useFactory` — use it to read `ConfigService`.
- v11+: dynamic modules are identified by reference — to share one configured instance, keep it in a
  const and import that const ([`versions.md`](versions.md)).

## Scopes ([docs](https://docs.nestjs.com/fundamentals/injection-scopes))

- `DEFAULT` (singleton): use it. Singletons must be stateless per request (no request data in fields).
- `REQUEST`: new instance per request, and **every consumer up the chain becomes request-scoped** (controller
  included) — measurable latency/GC cost. Use only when a library forces it (e.g. per-tenant connection);
  consider durable providers (`ContextIdStrategy`, v9+) for multi-tenant cases.
- `TRANSIENT`: new instance per consumer; for stateful helpers like per-class loggers.
- Request context without request scope: pass values as arguments, or `AsyncLocalStorage`
  (e.g. `nestjs-cls` if the project already uses it).

## Lifecycle ([docs](https://docs.nestjs.com/fundamentals/lifecycle-events))

- Init: `onModuleInit` → `onApplicationBootstrap` (may be async; bootstrap waits). Connect/warm-up here, not
  in constructors.
- Shutdown (only with `app.enableShutdownHooks()`): `onModuleDestroy` → `beforeApplicationShutdown(signal)`
  → `onApplicationShutdown(signal)`. Close pools, flush queues, stop consumers.
- v11: destroy runs in reverse init order; v12: hooks run by component hierarchy level. Never depend on
  hook order between unrelated modules — make each module close its own resources.
- Lifecycle hooks are not called on request-scoped or transient providers.

## Domain layering

- Nest decorators belong to the edges (controllers, modules, adapters). Keep domain services/entities
  framework-light so they unit-test without `TestingModule`.
- Follow the project's layer rule (`.github/instructions/`) and golden files; this file does not impose
  hexagonal/DDD on projects that don't use it.

## Optional pointers (open only if the project uses them)

- CQRS: [`@nestjs/cqrs`](https://docs.nestjs.com/recipes/cqrs) — commands/queries/events with handlers.
- Microservices: [overview](https://docs.nestjs.com/microservices/basics) — `@MessagePattern` (request/reply)
  vs `@EventPattern` (fire-and-forget); transport-specific changes in [`versions.md`](versions.md).
- Events in-process: [`@nestjs/event-emitter`](https://docs.nestjs.com/techniques/events).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/techniques/queues). Scheduling:
  [`@nestjs/schedule`](https://docs.nestjs.com/techniques/task-scheduling).
