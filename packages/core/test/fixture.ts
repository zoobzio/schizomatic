import type { Artifact, Handler, Validator } from "../src";

/** A user of the demo. */
export type User = {
  id: string;
  email: string;
  role: "admin" | "member";
  tags: string[];
};

/** A node of a recursive tree. */
export type Tree = { value: number; children: Tree[] };

/** An entry of the audit log. */
export type Entry = { actor: User; at: string; order: number[] };

/** The service of the demo artifact, as the kit would declare it. */
export type Schema = {
  user: Validator<User>;
  role: Validator<"admin" | "member">;
  tree: Validator<Tree>;
  audit: { entry: Validator<Entry> };
};

/** The handlers of the demo artifact, as the kit would declare them. */
export type Handlers = { sorted: Handler<Entry> };

/**
 * A stand-in for a built artifact. The kit writes the real one as
 * `index.mjs`. This one has the same shape: a global `defs` with every
 * schema and def, the paths that become validators, and one check.
 */
export const artifact: Artifact<Schema, Handlers> = {
  id: "demo",
  schemas: ["user", "role", "tree", "audit/entry"],
  checks: { "audit/entry": "sorted" },
  defs: {
    role: { enum: ["admin", "member"] },
    user: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        role: { $ref: "#/$defs/role" },
        tags: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["id", "email", "role"],
    },
    tree: {
      type: "object",
      properties: {
        value: { type: "integer", minimum: 0 },
        children: {
          type: "array",
          items: { $ref: "#/$defs/tree" },
          default: [],
        },
      },
      required: ["value"],
    },
    "audit/entry": {
      type: "object",
      properties: {
        actor: { $ref: "#/$defs/user" },
        at: { type: "string", format: "date-time" },
        order: { type: "array", items: { type: "integer" } },
      },
      required: ["actor", "at", "order"],
      additionalProperties: false,
    },
  },
};

/** A handler that requires the order of an entry to be ascending. */
export const sorted: Handler<Entry> = (entry) => {
  const problems = [];
  for (let i = 1; i < entry.order.length; i += 1) {
    if ((entry.order[i] ?? 0) < (entry.order[i - 1] ?? 0)) {
      problems.push({ message: "Out of order.", path: ["order", i] });
    }
  }
  return problems;
};

/** The options that bind the demo artifact. */
export const options = { handlers: { sorted } };
