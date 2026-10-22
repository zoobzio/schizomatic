import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { declaration, load, lowerOrThrow, typeName } from "../src";

const access = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/access/src/index.json")),
  "access",
);
const basic = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/basic/src/index.json")),
);

describe("typeName", () => {
  it("makes a Pascal case name from a def name", () => {
    expect(typeName("user")).toBe("User");
    expect(typeName("audit.log")).toBe("AuditLog");
    expect(typeName("partial-permissions")).toBe("PartialPermissions");
    expect(typeName("1st")).toBe("_1st");
  });
});

describe("declaration", () => {
  it("writes flat types with docs and the output of a default", () => {
    const found = declaration(basic);
    expect(found).toContain(
      'import type { Artifact } from "@schizomatic/core";',
    );
    expect(found).toContain('export type Role = "admin" | "member";');
    expect(found).toContain(
      "/** A user of the app. */\nexport type User = {\n  /** Stable user id */\n  id: string;",
    );
    expect(found).toContain("  tags: string[];");
    expect(found).toContain("  age?: number | null;");
    expect(found).toContain("  span?: [number, number];");
    expect(found).toContain("  meta?: { [K0 in string]: number };");
    expect(found).toContain(
      "export type Tree = {\n  value: number;\n  children: Tree[];\n};",
    );
    expect(found).toContain(
      "export type Kinds = {\n  user: User;\n  page: Page;\n  event: Event;\n  tree: Tree;\n};",
    );
    expect(found).toContain('export declare const id: "basic";');
    expect(found).not.toContain("Params");
  });

  it("writes a Params type and generic defs when the contract has params", () => {
    const found = declaration(access);
    expect(found).toContain(
      "export type Params = {\n  roles: string;\n  resources: string;\n  actions: Record<string, string>;\n  owner: Record<string, string>;\n};",
    );
    expect(found).toContain(
      'export type Role<P extends Params = Params> = P["roles"];',
    );
    expect(found).toContain(
      'export type Mention<P extends Params = Params> = `<${P["roles"]}>`;',
    );
    expect(found).toContain("export type Person = {\n  email: string;\n};");
    expect(found).toContain(
      'export type Bindings<P extends Params = Params> = { [K0 in P["roles"]]?: PersonGrant<P> | Mention<P> | Service };',
    );
    expect(found).toContain(
      'export type Roster<P extends Params = Params> = { [K0 in P["roles"]]: Assignment<P> };',
    );
    expect(found).toContain(
      'export type Priority<P extends Params = Params> = P["resources"][];',
    );
  });

  it("gives a scoped def a key parameter and passes the mapped key at the ref", () => {
    const found = declaration(access);
    expect(found).toContain(
      'export type Permissions<P extends Params = Params, K extends string = string> = { [K0 in P["actions"][K]]: Bindings<P> };',
    );
    expect(found).toContain(
      'export type Matrix<P extends Params = Params> = { [K0 in P["resources"]]: Permissions<P, K0> };',
    );
    expect(found).toContain(
      'export type Defaults<P extends Params = Params> = { [K0 in P["resources"]]: P["actions"][K0] };',
    );
    expect(found).toContain("  matrix: Matrix<P>;");
    expect(found).toContain(
      "export type Kinds<P extends Params = Params> = {\n  role: Role<P>;",
    );
    expect(found).toContain("  principal: Principal;\n");
  });
});
