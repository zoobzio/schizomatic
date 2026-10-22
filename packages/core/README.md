# @schizomatic/core

The runtime service over a built artifact. The service has a `check`, an
`assert`, a `parse`, and an `inspect` for each kind of the artifact.

The artifact is the `index.mjs` that [`@schizomatic/kit`](../kit) writes. It
carries its own copy of zod. This package calls `safeParse` on each validator
and nothing else. This package has no dependency on zod.

## Install

```sh
pnpm add @schizomatic/core
```

## Usage

```ts
import { makeService } from "@schizomatic/core";

import artifact, { type Kinds } from "./schema/index.mjs";

const schema = makeService<Kinds>(artifact, {
  params: { roles: ["admin", "viewer"] },
  handlers: { noSelfGrant },
});

schema.check.user(value); // boolean, narrows value to Kinds["user"]
schema.assert.user(value); // throws SchemaError with every issue
schema.parse.user(value); // returns the output, with defaults filled
schema.inspect.user(value); // { success, data } or { success, issues }
```

## The artifact

An artifact declares its `id`, its `kinds`, its `params`, and its `handlers`.
Its `make(params, handlers)` returns one validator for each kind. A validator
has `safeParse`. A zod schema is a validator, so a hand-written zod schema can
stand in for an artifact in a test.

- A **param** is a set or a map that the service binds at boot. A kind that
  reads a param, such as an enum over role names, resolves when `make` runs.
- A **handler** is a named check. The artifact calls it inside a zod `check`.

`makeService` checks the options against the declaration of the artifact
before it calls `make`. A missing param or a missing handler throws an
`ArtifactError` that lists every problem.

## Related

- [`@schizomatic/kit`](../kit) builds the artifact from JSON Schema.
- [`@schizomatic/contract`](../contract) is the contract format that the kit
  writes beside the artifact.
