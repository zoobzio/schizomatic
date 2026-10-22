# schizomatic

schizomatic builds typed validators from a directory of JSON Schema documents.
Each file is one schema. The path of the file is the path of its validator:
`src/audit/event.json` becomes `schema.audit.event`, with `check`, `assert`,
`parse`, and `inspect`, and the type `AuditEvent`.

[zod](https://zod.dev) does the validation. The runtime hands each document
to `z.fromJSONSchema` when the service starts. The build proves ahead of time
that zod can read each document, and prints the types. Nothing else is
invented here.

## Anatomy

```
my-schema/
  schizomatic.config.ts
  src/
    user.json         # schema.user, type User
    page.json         # schema.page, type Page
    audit/
      event.json      # schema.audit.event, type AuditEvent
  .dist/              # built: index.mjs  index.d.mts
```

```ts
// schizomatic.config.ts
import { defineConfig } from "@schizomatic/kit";

export default defineConfig({});
```

```sh
schizomatic build
```

```ts
import { makeService } from "@schizomatic/core";

import artifact, { type Schema, type User } from "./.dist/index.mjs";

const schema: Schema = makeService(artifact);

schema.user.check(value); // value is User
schema.user.parse(value); // returns User, throws SchemaError
schema.audit.event.inspect(value); // { success, data } or { success, issues }
```

A file can point to another with `$ref: "./user.json"`, or to a def of one
with `$ref: "./user.json#/$defs/role"`. A file can declare a **check**, a
named handler that the service binds at boot, for a rule that JSON Schema
cannot say. The declaration types each handler by the schema it checks.

## Workspace

| Directory                | Contents                              |
| ------------------------ | ------------------------------------- |
| [`packages`](./packages) | The runtime and the kit               |
| [`examples`](./examples) | Example schema packages and consumers |

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
