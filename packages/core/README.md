# @schizomatic/core

The runtime service over a built artifact. The service has a `check`, an
`assert`, a `parse`, and an `inspect` for each schema of the artifact, in a
tree that mirrors the source directory.

The artifact is the `index.mjs` that [`@schizomatic/kit`](../kit) writes. It
holds the JSON Schema documents and nothing else. This package builds each
one with `z.fromJSONSchema` of [zod](https://zod.dev) when the service starts.
zod does the validation. This package does the wrapping.

## Install

```sh
pnpm add @schizomatic/core
```

## Usage

```ts
import { makeService } from "@schizomatic/core";

import artifact, { type Schema } from "./schema/index.mjs";

const schema: Schema = makeService(artifact, {
  handlers: { noSelfGrant },
});

schema.user.check(value); // boolean, narrows value to User
schema.user.assert(value); // throws SchemaError with every issue
schema.user.parse(value); // returns User, with the defaults filled
schema.user.inspect(value); // { success, data } or { success, issues }
schema.audit.event.parse(value); // from src/audit/event.json
```

The declaration of a built schema types the artifact, so `makeService` needs
no type argument. Annotate the service with the `Schema` type of the
declaration: TypeScript asks for an explicit type on the variable that an
assertion function is called through.

## The artifact

An artifact declares its `id`, its `schemas`, its `checks`, and its `defs`.

- `defs` holds every schema and every def of the source, by name. Each schema
  is a self-contained JSON Schema once its `$ref`s resolve into `defs`.
- `schemas` lists the paths that become validators, such as `audit/event`.
- `checks` names the handler of each schema that declares one.

A **handler** is a named check that the service binds at boot. It runs after
zod accepts the value, so it receives the parsed output. It returns nothing
for a valid value, or one problem or a list of problems, each with a message
and a path relative to the value. A handler is where a rule that JSON Schema
cannot say lives, such as a graph with no cycle.

`makeService` checks the options before it builds. A missing handler, a
document that zod cannot build, or two paths that collide throw an
`ArtifactError` that lists every problem.

## Related

- [`@schizomatic/kit`](../kit) builds the artifact from a directory of JSON
  Schema documents.
