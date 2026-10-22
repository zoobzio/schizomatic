/**
 * The version of the contract format. A runtime rejects a contract with a
 * version it does not know.
 */
export const VERSION = 1;

/**
 * The node kinds of a contract. Each kind sets the shape of one {@link Node}.
 */
export const NODE_KINDS = [
  "string",
  "number",
  "boolean",
  "null",
  "unknown",
  "literal",
  "enum",
  "array",
  "tuple",
  "object",
  "record",
  "union",
  "discriminated",
  "intersection",
  "optional",
  "nullable",
  "default",
  "ref",
  "member",
  "custom",
] as const;

/**
 * The string formats that a `string` node can require.
 */
export const FORMATS = ["email", "uuid", "url", "datetime", "date"] as const;

/**
 * The kinds of a param. A `set` is a list of names. A `map` keys one set to a
 * value for each name.
 */
export const PARAM_KINDS = ["set", "map"] as const;
