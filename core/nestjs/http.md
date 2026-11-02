# NestJS HTTP layer — controllers, validation, enhancers, OpenAPI

Entry: [`../nestjs.md`](../nestjs.md). Version deltas: [`versions.md`](versions.md).

## Controllers ([docs](https://docs.nestjs.com/controllers))

- Thin: map the request to one service call and return its result. No repositories, no business branching.
- Return values (or promises/observables); use `@Res()` only for streaming/files and then with
  `{ passthrough: true }` so interceptors and filters still work.
- Status: `@HttpCode()` for non-default codes (e.g. 204 on delete); `@Header()` for static headers.
- Plural resource paths (`@Controller('users')`), REST verbs; no verbs in paths unless it's an action.
- Declare static routes before parameterized ones (`me` before `:id`) — required on v12 order-sensitive
  adapters, harmless before.
- Use built-in parse pipes for params: `@Param('id', ParseIntPipe)`, `ParseUUIDPipe`, `ParseEnumPipe`,
  `ParseBoolPipe`, `ParseArrayPipe`, `ParseDatePipe` (v11+).

## Route syntax by version ([v11 guide](https://docs.nestjs.com/v11/migration-guide))

| | ≤ v10 (Express 4) | v11+ (Express 5) |
|---|---|---|
| Catch-all | `'*'`, `'files/*'` | `'*splat'`, `'{*splat}'` (also matches root) |
| Optional | `':ext?'` | `'{:ext}'`, `'file{.:ext}'` |
| Regexp in path | allowed | not allowed — validate with a pipe |
| Middleware all routes | `forRoutes('*')` | `forRoutes('{*splat}')` |

v11 Express: nested query strings (`a[b]=1`) need `app.set('query parser', 'extended')`.

## DTOs & validation ([docs](https://docs.nestjs.com/techniques/validation))

- One class per input shape: `CreateXDto`, `UpdateXDto extends PartialType(CreateXDto)` (from
  `@nestjs/mapped-types`, or `@nestjs/swagger` when using Swagger so metadata is kept). Also `PickType`,
  `OmitType`, `IntersectionType`.
- Global pipe, configured once in `main.ts` (and reused by e2e tests):

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

- Every DTO property has a class-validator decorator (`@IsString()`, `@IsEmail()`, …); nested objects need
  `@ValidateNested()` + `@Type(() => Child)`; arrays `@IsArray()` + `{ each: true }`.
- With `transform: true`, query/param numbers are converted from the declared type; don't rely on implicit
  conversion for booleans (`'false'` is truthy) — use `@Transform` or `ParseBoolPipe`.
- v12+: alternatively Standard Schema — `@Body({ schema: createUserSchema })` + global
  `StandardSchemaValidationPipe` (from `@nestjs/common`); pick one approach per project, follow the existing
  one. `ValidationPipe({ errorFormat: 'grouped' })` returns errors keyed by property path.
- Never trust `@Body()` typed as an interface — interfaces have no runtime metadata, so nothing is validated.

## Serialization ([docs](https://docs.nestjs.com/techniques/serialization))

- Return response DTOs or entities annotated with `@Exclude()` (password, internal ids) and apply
  `ClassSerializerInterceptor` (global or per controller). It only acts on class instances, not plain objects.
- `@Expose()` for computed fields, `@SerializeOptions({ groups })` for role-based views.
- v12+: `StandardSchemaSerializerInterceptor` validates/transforms responses against a schema.

## Enhancers — who does what ([request lifecycle](https://docs.nestjs.com/faq/request-lifecycle))

Order: middleware → guards → interceptors (pre) → pipes → handler → interceptors (post) → exception filters.
Within each: global → controller → route.

- **Middleware** ([docs](https://docs.nestjs.com/middleware)): raw request concerns (correlation id, body
  parsers). Has no access to the handler/metadata.
- **Guards** ([docs](https://docs.nestjs.com/guards)): return boolean / throw `ForbiddenException`. Read
  metadata with `Reflector`; on v10.2+ prefer `Reflector.createDecorator<T>()` for typed metadata. v11:
  `getAllAndOverride` may return `undefined`.
- **Interceptors** ([docs](https://docs.nestjs.com/interceptors)): wrap the handler with RxJS — response
  mapping, timeouts, caching, timing logs. Don't put authorization or validation here.
- **Pipes** ([docs](https://docs.nestjs.com/pipes)): transform/validate one argument; throw
  `BadRequestException`. v12: stricter `transform` signature, generic `ArgumentMetadata`.
- **Filters** ([docs](https://docs.nestjs.com/exception-filters)): convert exceptions to responses.
- Register globals that need DI as providers (`{ provide: APP_GUARD | APP_PIPE | APP_INTERCEPTOR |
  APP_FILTER, useClass: X }`), not `app.useGlobal*()` — those live outside the DI graph and `main.ts` code
  does not run in e2e tests, so they must be re-applied there by hand.

## Exceptions ([docs](https://docs.nestjs.com/exception-filters))

- Use built-ins: `BadRequestException`, `UnauthorizedException`, `ForbiddenException`,
  `NotFoundException`, `ConflictException`, `UnprocessableEntityException`, … Pass `{ cause }` to keep the
  original error. v12: `errorCode` option for machine-readable codes.
- Domain layer throws domain errors; one filter (`@Catch(DomainError)`) maps them to HTTP. Don't import
  `HttpException` into domain code.
- Unknown errors become 500 via the base filter; never put stack traces or SQL in the body. Log once, at
  the filter, with the correlation id.
- Custom filter for everything: `@Catch()` + `HttpAdapterHost` (platform-agnostic), extend
  `BaseExceptionFilter` to keep default behavior.
- v11+: `IntrinsicException` subclasses are not logged automatically by the framework.

## Versioning ([docs](https://docs.nestjs.com/techniques/versioning))

- Enable once: `app.enableVersioning({ type: VersioningType.URI })` (or `HEADER`/`MEDIA_TYPE`); mark with
  `@Version('2')` or `@Controller({ version: '2' })`. Keep old versions until consumers migrate; use
  `VERSION_NEUTRAL` for unversioned routes.

## OpenAPI ([docs](https://docs.nestjs.com/openapi/introduction))

- `DocumentBuilder` + `SwaggerModule.createDocument` + `SwaggerModule.setup('docs', app, factory)` in
  `main.ts`; disable or protect in production if the API is private.
- Enable the `@nestjs/swagger` CLI plugin in `nest-cli.json` to infer `@ApiProperty` from DTOs; add
  decorators only for what it can't infer (examples, enums, `@ApiResponse` for errors).
- Import mapped types from `@nestjs/swagger` so OpenAPI metadata survives `PartialType` etc.
- Auth: `.addBearerAuth()` + `@ApiBearerAuth()` on protected controllers.
