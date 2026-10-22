# @schizomatic/kit

The kit reads JSON Schema documents and writes modules for a runtime service.
The input is a root document and the documents that it references with
`$ref`. A `schizomatic.config.ts` file points at the root document.

The kit writes three kinds of output:

- **Contract:** `contract.json`, the compact form that
  [`@schizomatic/core`](../core) reads.
- **Validators:** `index.mjs`, the compiled rules over the atoms of core.
- **Declarations:** `index.d.mts`, the flat types written out from the
  contract, with one type parameter for the params.

The kit lowers each document to the contract. The kit then builds the same
schema with `z.fromJSONSchema` and runs a fixture set through both. The two
must agree. Zod is a dependency of the kit only.

## Install

```sh
pnpm add -D @schizomatic/kit
```

## Config

```ts
import { defineConfig } from "@schizomatic/kit";

export default defineConfig({
  // Required. The root JSON Schema document.
  source: "./src/index.json",

  // Optional. The identity of the contract.
  id: "app",

  // Optional. The output directory. The default is `.dist`.
  outDir: ".dist",
});
```

```sh
schizomatic build
```
