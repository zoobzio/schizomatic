# @schizomatic/schema

The contract format. A contract is a JSON document that a build writes and a
runtime reads. The package has the node types, the param types, and the
constants of the format. It has no dependency.

## Install

```sh
pnpm add @schizomatic/schema
```

## The contract

- `defs` holds the named nodes. A `ref` node points to a def.
- `kinds` names the public entry points. Each kind points to a def.
- `params` declares the sets and the maps that a service binds at boot.

A node is JSON. A node holds no function. A `custom` node names a handler by
id. The service receives the handler at boot.

## Related

- [`@schizomatic/core`](../core) compiles a contract to a service.
- [`@schizomatic/kit`](../kit) writes a contract from JSON Schema.
