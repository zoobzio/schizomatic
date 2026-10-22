/**
 * A validation failure. The shape follows the issue of zod: a `code`, a
 * `path` from the root to the failure, and a readable `message`. The built
 * artifact produces the issues. The service passes them through.
 */
export type Issue = {
  code: string;
  message: string;
  path: PropertyKey[];
};

/**
 * The outcome of a parse by the artifact. The shape follows `safeParse` of
 * zod. The service reads `success`, `data`, and `error.issues`. It reads no
 * other member.
 */
export type Parsed =
  | { success: true; data: unknown }
  | { success: false; error: { issues: Issue[] } };

/**
 * A compiled validator of one kind. The artifact makes one for each kind.
 * The service calls `safeParse` and nothing else. A zod schema satisfies
 * this type, so a hand-written zod schema can stand in for an artifact in a
 * test.
 */
export type Validator = {
  safeParse: (v: unknown) => Parsed;
};

/**
 * A handler for a named check of the contract. The artifact calls the handler
 * inside a zod `check`. The handler returns `undefined` for a valid value and
 * a message for an invalid value, with the path relative to the value.
 */
export type Handler = (
  v: unknown,
) => { message: string; path?: PropertyKey[] } | undefined;

/**
 * The values that a service binds to the params of a contract. A `set` param
 * takes a list of names. A `map` param takes a record from each name of its
 * key set to a list of names or to one enum value.
 */
export type Params = Record<
  string,
  readonly string[] | Record<string, readonly string[] | string>
>;

/**
 * The built artifact. The kit writes it as `index.mjs`. `make` builds the
 * validators from the params and the handlers. The artifact carries its own
 * copy of zod, so the service has no dependency on zod.
 */
export type Artifact = {
  id: string;
  kinds: readonly string[];
  params: readonly string[];
  handlers: readonly string[];
  make: (
    params: Params,
    handlers: Record<string, Handler>,
  ) => Record<string, Validator>;
};

/**
 * The options of a service. `params` binds the params of the contract.
 * `handlers` supplies a function for each named check.
 */
export type Options = {
  params?: Params;
  handlers?: Record<string, Handler>;
};

/**
 * The outcome of an `inspect`. A success result holds the value narrowed to
 * the type of the kind. A failure result holds the issues.
 */
export type Result<V> =
  | { success: true; data: V }
  | { success: false; issues: Issue[] };

/**
 * A boolean type predicate for each kind.
 */
export type Check<K> = { [N in keyof K]: (v: unknown) => v is K[N] };

/**
 * An assertion for each kind. A failed assertion throws a `SchemaError`.
 */
export type Assert<K> = { [N in keyof K]: (v: unknown) => asserts v is K[N] };

/**
 * A parse for each kind. The function returns the output value narrowed to
 * its kind. The output has the defaults filled and the stripped keys removed.
 */
export type Parse<K> = { [N in keyof K]: (v: unknown) => K[N] };

/**
 * An inspect for each kind. The function returns a {@link Result}.
 */
export type Inspect<K> = { [N in keyof K]: (v: unknown) => Result<K[N]> };

/**
 * The service over an artifact. `K` maps each kind to the type it narrows
 * to. The kit writes `K` in the declarations of a built schema.
 */
export type Service<K> = {
  id: string;
  check: Check<K>;
  assert: Assert<K>;
  parse: Parse<K>;
  inspect: Inspect<K>;
};
