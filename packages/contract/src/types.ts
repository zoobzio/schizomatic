import type { FORMATS, NODE_KINDS, PARAM_KINDS, VERSION } from "./constant";

/**
 * The version of the contract format.
 */
export type Version = typeof VERSION;

/**
 * The kind of a node. A kind is a key of {@link NODE_KINDS}.
 */
export type NodeKind = (typeof NODE_KINDS)[number];

/**
 * A string format that the runtime checks.
 */
export type Format = (typeof FORMATS)[number];

/**
 * A JSON value. Literals, defaults, and enum members hold JSON.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/**
 * A type hint for the printer. The printer writes the hint in place of the
 * type it derives from the node. A hint carries a TypeScript type that JSON
 * Schema cannot express, such as a template literal.
 */
export type Hint = { ts?: string; doc?: string };

/**
 * A field of an `object` node.
 */
export type Field = Hint & { node: Node; optional?: boolean };

/**
 * A node of a contract. Each node is JSON. A node holds no function. A `ref`
 * node points to a def by name. A `member` node reads a param at service
 * time. A `custom` node names a handler that the service receives at boot.
 */
export type Node = Hint &
  (
    | {
        t: "string";
        min?: number;
        max?: number;
        pattern?: string;
        format?: Format;
      }
    | {
        t: "number";
        int?: boolean;
        min?: number;
        max?: number;
        exclusiveMin?: number;
        exclusiveMax?: number;
        multipleOf?: number;
      }
    | { t: "boolean" }
    | { t: "null" }
    | { t: "unknown" }
    | { t: "literal"; value: string | number | boolean | null }
    | { t: "enum"; values: (string | number)[] }
    | { t: "array"; item: Node; min?: number; max?: number; unique?: boolean }
    | { t: "tuple"; items: Node[]; rest?: Node }
    | {
        t: "object";
        fields: Record<string, Field>;
        extra: "strip" | "strict" | "passthrough";
        catchall?: Node;
        /* The keys must be a subset, a superset, or exactly the members of a set param. */
        keys?: { subset?: string; superset?: string };
        /* The value schema for a key comes from a map param. */
        valueBy?: { param: string; schemas: Record<string, Node> };
      }
    | { t: "record"; key: Node; value: Node }
    | { t: "union"; options: Node[] }
    | { t: "discriminated"; tag: string; options: Record<string, Node> }
    | { t: "intersection"; parts: Node[] }
    | { t: "optional"; inner: Node }
    | { t: "nullable"; inner: Node }
    | { t: "default"; inner: Node; value: Json }
    | { t: "ref"; name: string }
    | {
        t: "member";
        /* The set param that holds the allowed values. */
        param: string;
        /* The slice of the string to look up, such as `[1, -1]` for `{name}`. */
        slice?: [number, number];
        /* The map param and the value that the member must map to. */
        typed?: { param: string; equals: string };
      }
    | { t: "custom"; id: string; inner: Node }
  );

/**
 * The kind of a param. A kind is a key of {@link PARAM_KINDS}.
 */
export type ParamKind = (typeof PARAM_KINDS)[number];

/**
 * A param that a service binds at boot. A `set` param is a list of names. A
 * `map` param keys one set param to a value for each name. The value is a
 * set or a member of an enum.
 */
export type Param =
  | { kind: "set" }
  | { kind: "map"; keys: string; of: "set" }
  | { kind: "map"; keys: string; of: "enum"; values: string[] };

/**
 * A contract. The contract is JSON. `defs` holds the named nodes. `kinds`
 * names the public entry points. Each kind points to a def. `params` declares
 * the sets and the maps that a service binds at boot.
 */
export type Contract = {
  id: string;
  version: Version;
  defs: Record<string, Node>;
  kinds: Record<string, string>;
  params?: Record<string, Param>;
};
