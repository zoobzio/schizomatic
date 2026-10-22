# @schizomatic/kit

The kit reads a directory of JSON Schema documents and writes an artifact for
the runtime service. Each file is one schema. The path of the file is the
path of its validator in the service: `src/audit/event.json` becomes
`schema.audit.event`.

The kit writes two files:

- **`index.mjs`** is the artifact: the documents as data. The artifact
  imports nothing. [`@schizomatic/core`](../core) builds each document with
  `z.fromJSONSchema` of zod when the service starts.
- **`index.d.mts`** is the declaration of the artifact. Each schema and each
  def is an exported type, written out flat. `Schema` is the type of the
  service. `Handlers` types each handler by the schema it checks.

zod does the validation. The kit proves at build time that zod can build
each document, and prints the types. That is all it does.

## Install

```sh
pnpm add -D @schizomatic/kit
```

## Config

```ts
import { defineConfig } from "@schizomatic/kit";

export default defineConfig({
  // Optional. The source directory. The default is `./src`.
  source: "./src",

  // Optional. The identity of the artifact. The default is the name of the project directory.
  id: "app",

  // Optional. The output directory. The default is `.dist`.
  outDir: ".dist",
});
```

```sh
schizomatic build
```

## The source

Every `.json` file under the source is a schema. A file or a directory whose
name starts with a dot is skipped.

```
src/
  user.json          # schema.user, type User
  page.json          # schema.page, type Page
  audit/
    event.json       # schema.audit.event, type AuditEvent
```

A file is JSON Schema 2020-12. Its `$defs` are its private parts. A `$ref`
has three forms:

- `#/$defs/name` points to a def of the same file.
- `./file.json` points to another file. `../` walks up. A file can point to
  itself this way for a recursive schema.
- `./file.json#/$defs/name` points to a def of another file.

Every name is global in the artifact. Two files that define the same def, a
def with the name of a file, and two names that make the same type name each
fail the build.

## Keywords

The kit hands each document to `z.fromJSONSchema`. What zod reads, the
service checks. That is the keywords of 2020-12 that zod supports, including
`$ref`, `prefixItems`, `patternProperties`, `propertyNames`, `contains`,
`dependentRequired`, `uniqueItems`, and `default`. zod rejects `not`,
`if`/`then`/`else`, `dependentSchemas`, `unevaluatedItems`, and
`unevaluatedProperties`. A document that zod cannot build fails the build,
with the path and the reason zod gives.

The semantics are those of JSON Schema. An object admits a key it does not
declare unless `additionalProperties` is `false`. An item of a tuple past
`minItems` is optional. A `default` fills the output of `parse`.

The declaration follows the same rules. A property with a `default` is not
optional in the type. `additionalProperties` and `patternProperties` print as
an index signature. `description` prints as JSDoc.

## The extension

The `x-schizomatic` key of a schema adds what JSON Schema cannot say.

- **`check`** names a handler. It is allowed at the root of a file only. The
  service supplies the handler at boot and runs it after zod accepts the
  value. A rule that reads across a value, such as a graph with no cycle,
  lives in a handler.
- **`ts`** replaces the printed type of the schema.

```json
{
  "type": "string",
  "pattern": "^<(admin|viewer)>$",
  "x-schizomatic": { "ts": "`<${Role}>`" }
}
```

The artifact holds neither member. The declaration types each handler by the
schema it checks:

```ts
export type Handlers = {
  noSelfGrant: Handler<Bindings>;
};
```

## Related

- [`@schizomatic/core`](../core) makes the service over the artifact.
