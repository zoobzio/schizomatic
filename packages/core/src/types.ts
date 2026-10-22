import type { Contract } from "@schizomatic/contract";

/**
 * The failure codes of a rule. Each atom returns one code. The combinators
 * return the structural codes and the alternation code.
 */
export type Code =
  | "not_string"
  | "not_number"
  | "not_boolean"
  | "not_null"
  | "not_object"
  | "not_array"
  | "not_literal"
  | "not_member"
  | "not_format"
  | "no_pattern"
  | "out_of_range"
  | "bad_length"
  | "duplicate"
  | "not_exhaustive"
  | "type_mismatch"
  | "unknown_key"
  | "missing_key"
  | "no_match"
  | "custom";

/**
 * A validation failure. `code` identifies the failure. `message` is readable
 * text. `path` holds the keys from the root to the failure. `expected` holds
 * the value that the contract requires. `received` holds the value that
 * failed.
 */
export type Issue = {
  code: Code;
  message: string;
  path?: (string | number)[];
  expected?: unknown;
  received?: unknown;
};

/**
 * A validation rule. The rule returns an {@link Issue} for an invalid value.
 * The rule returns `undefined` for a valid value.
 */
export type Rule = (v: unknown) => Issue | undefined;

/**
 * A handler for a `custom` node. The service receives the handlers at boot.
 */
export type Handler = Rule;

/**
 * The outcome of an `inspect`. A success result holds the value narrowed to
 * the type of the kind. A failure result holds the issues.
 */
export type Result<V> =
  | { success: true; data: V }
  | { success: false; issues: Issue[] };

/**
 * The values that a service binds to the params of a contract. A `set` param
 * takes a list of names. A `map` param takes a record.
 */
export type Params = Record<
  string,
  readonly string[] | Record<string, unknown>
>;

/**
 * The options of a service. `params` binds the params of the contract.
 * `handlers` supplies a rule for each `custom` node by id.
 */
export type Options = {
  params?: Params;
  handlers?: Record<string, Handler>;
};

/**
 * A boolean type predicate for each kind.
 */
export type Check<K> = { [N in keyof K]: (v: unknown) => v is K[N] };

/**
 * An assertion for each kind. A failed assertion throws a `SchemaError`.
 */
export type Assert<K> = { [N in keyof K]: (v: unknown) => asserts v is K[N] };

/**
 * A parse for each kind. The function returns the value narrowed to its kind.
 */
export type Parse<K> = { [N in keyof K]: (v: unknown) => K[N] };

/**
 * An inspect for each kind. The function returns a {@link Result}.
 */
export type Inspect<K> = { [N in keyof K]: (v: unknown) => Result<K[N]> };

/**
 * The service over a contract. `K` maps each kind to the type it narrows to.
 * The kit writes `K` in the declarations of a built schema.
 */
export type Service<K> = {
  contract: Contract;
  check: Check<K>;
  assert: Assert<K>;
  parse: Parse<K>;
  inspect: Inspect<K>;
};
