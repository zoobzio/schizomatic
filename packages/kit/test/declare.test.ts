import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { declaration, load, type, typeName } from "../src";

const basic = load(resolve(import.meta.dirname, "fixtures/basic/src"), "basic");
const access = load(
  resolve(import.meta.dirname, "fixtures/access/src"),
  "access",
);

describe("typeName", () => {
  it("makes a Pascal case name from a name of the source", () => {
    expect(typeName("user")).toBe("User");
    expect(typeName("audit/log")).toBe("AuditLog");
    expect(typeName("partial-permissions")).toBe("PartialPermissions");
    expect(typeName("1st")).toBe("_1st");
  });
});

describe("type", () => {
  it("prints the scalars, the literals, and the boolean schemas", () => {
    expect(type({ type: "string" })).toBe("string");
    expect(type({ type: "integer" })).toBe("number");
    expect(type({ type: ["string", "null"] })).toBe("string | null");
    expect(type({ const: "a" })).toBe('"a"');
    expect(type({ enum: ["a", 1, null] })).toBe('"a" | 1 | null');
    expect(type(true)).toBe("unknown");
    expect(type(false)).toBe("never");
    expect(type({})).toBe("unknown");
    expect(type({ type: "date" })).toBe("unknown");
  });

  it("prints a tuple with the items past minItems optional", () => {
    expect(
      type({ prefixItems: [{ type: "number" }, { enum: ["a", "b"] }] }),
    ).toBe('[number?, ("a" | "b")?]');
    expect(
      type({
        prefixItems: [{ type: "number" }],
        items: { type: "string" },
        minItems: 1,
      }),
    ).toBe("[number, ...string[]]");
    expect(type({ type: "array" })).toBe("unknown[]");
  });

  it("prints an object with its index signature", () => {
    expect(type({ type: "object" })).toBe("{ [key: string]: unknown }");
    expect(type({ type: "object", additionalProperties: false })).toBe(
      "Record<string, never>",
    );
    expect(type({ additionalProperties: { type: "number" } })).toBe(
      "{ [key: string]: number }",
    );
    expect(
      type({
        properties: { a: { type: "string" } },
        patternProperties: { "^x": { type: "number" } },
      }),
    ).toBe("{\n  a?: string;\n} & { [key: string]: number }");
  });

  it("combines a type with allOf and anyOf", () => {
    expect(
      type({ type: "string", anyOf: [{ const: "a" }, { const: "b" }] }),
    ).toBe('string & ("a" | "b")');
    expect(
      type({ allOf: [{ $ref: "#/$defs/a" }, { $ref: "#/$defs/b" }] }),
    ).toBe("A & B");
  });

  it("prefers the ts extension", () => {
    expect(
      type({ type: "string", "x-schizomatic": { ts: "`#${string}`" } }),
    ).toBe("`#${string}`");
  });
});

describe("declaration", () => {
  it("writes a type for each schema and def, with docs", () => {
    const found = declaration(basic);
    expect(found).toContain(
      'import type { Artifact, Handler, Validator } from "@schizomatic/core";',
    );
    expect(found).toContain('export type Role = "admin" | "member";');
    expect(found).toContain(
      "/** A user of the app. */\nexport type User = {\n  /** Stable user id */\n  id: string;",
    );
    expect(found).toContain("  tags: string[];");
    expect(found).toContain("  age?: number | null;");
    expect(found).toContain("  span?: [number, number];");
    expect(found).toContain("  meta?: { [key: string]: number };");
    expect(found).toContain(
      "export type Tree = {\n  value: number;\n  children: Tree[];\n};",
    );
    expect(found).toContain(
      "/** One entry of the audit log. */\nexport type AuditLog = {",
    );
  });

  it("writes the service as a tree and the handlers by schema", () => {
    const found = declaration(basic);
    expect(found).toContain(
      "export type Schema = {\n  audit: {\n    log: Validator<AuditLog>;\n  };\n  event: Validator<Event>;\n  page: Validator<Page>;\n  tree: Validator<Tree>;\n  user: Validator<User>;\n};",
    );
    expect(found).toContain(
      "export type Handlers = {\n  sorted: Handler<AuditLog>;\n};",
    );
    expect(found).toContain('export declare const id: "basic";');
    expect(found).toContain(
      'export declare const schemas: readonly ["audit/log","event","page","tree","user"];',
    );
    expect(found).toContain(
      'export declare const checks: {"audit/log":"sorted"};',
    );
    expect(found).toContain(
      "declare const artifact: Artifact<Schema, Handlers>;\nexport default artifact;",
    );
  });

  it("writes an empty Handlers type when no schema has a check", () => {
    expect(declaration({ ...basic, checks: {} })).toContain(
      "export type Handlers = Record<never, never>;",
    );
  });

  it("uses the ts extension and names a nested path", () => {
    const found = declaration(access);
    expect(found).toContain("export type Mention = `<${Role}>`;");
    expect(found).toContain("export type PolicyFull = {");
    expect(found).toContain("  policy: {\n    full: Validator<PolicyFull>;");
  });
});
