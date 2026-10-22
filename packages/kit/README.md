# @schizomatic/kit

The kit reads JSON Schema documents and writes an artifact for a runtime
service. The input is a root document and the documents that it references
with `$ref`. A `schizomatic.config.ts` file points at the root document.

The kit writes three files:

- **`contract.json`** is the contract: the compact form of the documents, for
  tooling.
- **`index.mjs`** is the artifact. The kit prints zod source from the contract
  and bundles it with `zod/mini` inlined. The artifact imports nothing. A
  service that imports it has no dependency on zod.
- **`index.d.mts`** is the declaration of the artifact. Each def is a flat
  type written out from the contract. A consumer that imports a type gets one
  object literal type, not an inferred tree.

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

  // Optional. The identity of the contract. The default is the $id of the root.
  id: "app",

  // Optional. The output directory. The default is `.dist`.
  outDir: ".dist",
});
```

```sh
schizomatic build
```

## The root document

The root document is JSON Schema 2020-12. Its `$defs` are the defs of the
contract. The `x-schizomatic` key of the root names the **kinds** and declares
the **params**.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "app",
  "x-schizomatic": {
    "kinds": { "user": "user", "page": "page" }
  },
  "$defs": {
    "user": { "$ref": "./user.json" },
    "page": { "$ref": "./page.json" }
  }
}
```

A `$ref` has three forms:

- `#/$defs/name` points to a def.
- `./file.json` inlines the file. The `$defs` of the file hoist to the root.
- `./file.json#/$defs/name` loads the file for its `$defs` and points to the
  def.

Every def name is global. Two files that define the same name fail the build.

## Keywords

The kit maps these keywords. Any other keyword fails the build with its path.

| JSON Schema                                                                 | Artifact                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `type: string`, `minLength`, `maxLength`, `pattern`, `format`               | `z.string()` with checks                                            |
| `format: email`, `uuid`, `uri`, `url`, `date-time`, `date`                  | `z.email()`, `z.uuid()`, …                                          |
| `type: number`, `integer`, `minimum`, `maximum`, `exclusive*`, `multipleOf` | `z.number()`, `z.int()` with checks                                 |
| `type: boolean`, `null`, `true`                                             | `z.boolean()`, `z.null()`, `z.unknown()`                            |
| `const`, `enum`                                                             | `z.literal()`, `z.enum()`                                           |
| `type: array`, `items`, `minItems`, `maxItems`, `uniqueItems`               | `z.array()` with checks                                             |
| `prefixItems`, `items`                                                      | `z.tuple()`                                                         |
| `type: object`, `properties`, `required`, `additionalProperties`            | `z.object()`, `z.strictObject()`, `z.looseObject()`, `z.catchall()` |
| `additionalProperties` alone                                                | `z.record()`                                                        |
| `propertyNames`                                                             | a check on each key                                                 |
| `anyOf`, `oneOf`                                                            | `z.union()`                                                         |
| `allOf`                                                                     | `z.intersection()`                                                  |
| `type: ["string", "null"]`                                                  | `z.nullable()`                                                      |
| `default`                                                                   | `z._default()`                                                      |
| `description`                                                               | JSDoc in the declaration                                            |

An object with `properties` strips the keys it does not declare, as zod does.
`additionalProperties: false` rejects them. `additionalProperties: true`
keeps them.

## The extension

The `x-schizomatic` key of a schema adds what JSON Schema cannot say.

```json
{ "type": "string", "x-schizomatic": { "ts": "`#${string}`" } }
```

- **`ts`** replaces the printed type of the node.
- **`discriminator`** on a `oneOf` names the tag. Each option sets a `const`
  at the tag. The artifact uses `z.discriminatedUnion()`.
- **`check`** names a handler. The service supplies the handler at boot. The
  artifact runs it as a zod check.

## Params

A param is a set or a map that the service binds at boot. A schema that reads
a param resolves when `make` runs. This is how a schema parameterized by
data, such as the role names of an app, becomes one artifact with generic
types.

```json
{
  "x-schizomatic": {
    "params": {
      "roles": { "kind": "set" },
      "resources": { "kind": "set" },
      "actions": { "kind": "map", "keys": "resources", "of": "set" },
      "owner": {
        "kind": "map",
        "keys": "roles",
        "of": "enum",
        "values": ["person", "service"]
      }
    }
  }
}
```

A schema reads a param with these extension members:

- **`member`** on a string. The value must be in the set. `slice: [1, -1]`
  looks up the inner part of `{name}`. `typed: { param, equals }` requires
  the map to give that value for the name.
- **`keys`** on an object. `subset`, `superset`, or `exact` names the set
  that the keys must relate to.
- **`exhaustive`** on an array. The items must cover the set.
- **`valueBy`** on an object. `param` names a map of enum values. `schemas`
  gives the value schema for each enum value. The value at a key uses the
  schema for the map value of the key.

A set reference is a set param name, or `{ "param": "actions", "at": "$key" }`
to index a map of sets by the key of the enclosing entry. A def that reads
`$key` becomes a factory of the key in the artifact and takes `K extends
string` in the declaration.

The declaration exports `Params`. Narrow each member to its union to type a
service:

```ts
import { makeService } from "@schizomatic/core";

import artifact, { type Kinds } from "./schema/index.mjs";

type P = {
  roles: "admin" | "viewer";
  resources: "doc";
  actions: { doc: "read" | "write" };
  owner: Record<string, string>;
};

const schema = makeService<Kinds<P>>(artifact, { params, handlers });
```

## Related

- [`@schizomatic/core`](../core) makes the service over the artifact.
- [`@schizomatic/schema`](../schema) is the contract format.
