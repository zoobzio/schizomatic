# Packages

| Package                             | Directory              | Description                                                                               |
| ----------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| [`schizomatic`](./schizomatic)      | `packages/schizomatic` | The public package. It re-exports the runtime and the contract types.                     |
| [`@schizomatic/schema`](./schema)   | `packages/schema`      | The contract format: the node types, the params, and the constants of the format.         |
| [`@schizomatic/core`](./core)       | `packages/core`        | The runtime. Compiles a contract to a service with `check`, `assert`, `parse`, `inspect`. |
| [`@schizomatic/kit`](./kit)         | `packages/kit`         | Builds JSON Schema into the contract, the validators, and the declarations.               |
| [`@schizomatic/testing`](./testing) | `packages/testing`     | Fixtures, mock contracts, and the proof helpers for tests.                                |
