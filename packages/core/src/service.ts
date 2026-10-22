import type {
  Artifact,
  Assert,
  Check,
  Inspect,
  Options,
  Parse,
  Result,
  Service,
  Validator,
} from "./types";

import { SchemaError } from "./error";
import { verify } from "./verify";

/**
 * Makes the four bundles over a validator. Each bundle member calls
 * `safeParse` once. `check` reads `success`. `assert` throws a
 * {@link SchemaError} with the issues. `parse` returns the output. `inspect`
 * returns a {@link Result}.
 */
const bundle = (validator: Validator) => {
  const inspect = (v: unknown): Result<unknown> => {
    const parsed = validator.safeParse(v);
    if (parsed.success) {
      return { success: true, data: parsed.data };
    }
    return { success: false, issues: parsed.error.issues };
  };
  const parse = (v: unknown): unknown => {
    const result = inspect(v);
    if (!result.success) {
      throw new SchemaError(result.issues);
    }
    return result.data;
  };
  return {
    check: (v: unknown): boolean => validator.safeParse(v).success,
    assert: (v: unknown): void => {
      parse(v);
    },
    parse,
    inspect,
  };
};

/**
 * Makes the service over a built artifact. The function checks the options
 * against the params and the handlers that the artifact declares. Then it
 * calls `make` of the artifact once. The service holds one validator for each
 * kind. The artifact carries its own copy of zod, so this package has no
 * dependency on zod.
 *
 * `K` maps each kind to the type it narrows to. The declarations of a built
 * schema export `K` as `Kinds`.
 *
 * @param artifact - The built artifact, the default export of `index.mjs`.
 * @param options - The params and the handlers for the artifact.
 */
export const makeService = <K>(
  artifact: Artifact,
  options: Options = {},
): Service<K> => {
  verify(artifact, options);
  const validators = artifact.make(
    options.params ?? {},
    options.handlers ?? {},
  );

  const check = {} as Record<string, unknown>;
  const assert = {} as Record<string, unknown>;
  const parse = {} as Record<string, unknown>;
  const inspect = {} as Record<string, unknown>;

  for (const kind of artifact.kinds) {
    const validator = validators[kind];
    if (validator === undefined) {
      throw new Error(
        `@schizomatic/core: the artifact ${JSON.stringify(artifact.id)} declares the kind ${JSON.stringify(kind)} but make() returned no validator for it`,
      );
    }
    const made = bundle(validator);
    check[kind] = made.check;
    assert[kind] = made.assert;
    parse[kind] = made.parse;
    inspect[kind] = made.inspect;
  }

  return {
    id: artifact.id,
    check: check as Check<K>,
    assert: assert as Assert<K>,
    parse: parse as Parse<K>,
    inspect: inspect as Inspect<K>,
  };
};
