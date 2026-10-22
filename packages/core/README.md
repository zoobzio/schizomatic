# @schizomatic/core

The runtime. The package compiles a contract to a service. The service has a
`check`, an `assert`, a `parse`, and an `inspect` for each kind of the
contract. The package has no dependency on zod or on any schema library.

## Install

```sh
pnpm add @schizomatic/core
```

## Usage

```ts
import { makeService } from "@schizomatic/core";
import type { Kinds } from "./schema/index.mjs";

import contract from "./schema/contract.json" with { type: "json" };

const schema = makeService<Kinds>(contract, {
  params: { tokens: ["primary", "surface"] },
  handlers: { acyclic },
});

schema.check.user(value); // boolean, narrows value
schema.assert.user(value); // throws SchemaError with every Issue
schema.parse.user(value); // returns the narrowed value
schema.inspect.user(value); // { success, data } or { success, issues }
```

## Related

- [`@schizomatic/contract`](../contract) is the contract format.
- [`@schizomatic/kit`](../kit) writes a compiled module that targets the atoms
  of this package.
