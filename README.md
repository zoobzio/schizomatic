# schizomatic

schizomatic builds typed validators from JSON Schema. The source of a package
is `schizomatic.config.ts` and a set of JSON Schema documents. The build
derives three things from the documents: a **contract**, a **validator
module**, and **declarations**.

- The contract is a compact JSON document. It is the only thing that crosses
  from the build to a runtime service.
- The validator module runs the contract over the atoms of
  [`@schizomatic/core`](./packages/core). A service that imports it has no
  dependency on zod or on any schema library.
- The declarations are flat types written out from the contract. A consumer
  that imports a type gets one object literal type, not an inferred tree.

A contract can declare **params**: named sets and maps that a service binds at
boot. A rule that reads a param resolves when the service compiles. This is
how a schema parameterized by data, such as a token contract, becomes one
contract with generic types.

## Anatomy

```
my-schema/
  schizomatic.config.ts
  src/
    index.json        # kinds, params, $ref to the parts
    user.json
    page.json
  .dist/              # built: contract.json  index.mjs  index.d.mts
```

```ts
// schizomatic.config.ts
import { defineConfig } from "@schizomatic/kit";

export default defineConfig({ source: "./src/index.json" });
```

```sh
schizomatic build
```

```ts
import schema, { type User } from "./.dist/index.mjs";

schema.check.user(value); // value is User
schema.parse.user(value); // returns User, throws SchemaError
```

## Workspace

| Directory                | Contents                                        |
| ------------------------ | ----------------------------------------------- |
| [`packages`](./packages) | The contract, the runtime, the kit, and testing |
| [`examples`](./examples) | Example schema packages and consumers           |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## License

MIT
