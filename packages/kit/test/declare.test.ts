import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { declaration, load, lowerOrThrow, typeName } from "../src";

const tokens = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/tokens/src/index.json")),
  "tokens",
);
const basic = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/basic/src/index.json")),
);

describe("typeName", () => {
  it("makes a Pascal case name from a def name", () => {
    expect(typeName("user")).toBe("User");
    expect(typeName("color.bg")).toBe("ColorBg");
    expect(typeName("partial-contexts")).toBe("PartialContexts");
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
    const found = declaration(tokens);
    expect(found).toContain(
      "export type Params = {\n  tokens: string;\n  modifiers: string;\n  contexts: Record<string, string>;\n  types: Record<string, string>;\n};",
    );
    expect(found).toContain(
      'export type Token<P extends Params = Params> = P["tokens"];',
    );
    expect(found).toContain(
      'export type Reference<P extends Params = Params> = `{${P["tokens"]}}`;',
    );
    expect(found).toContain("export type Color = {\n  hex: string;\n};");
    expect(found).toContain(
      'export type Overrides<P extends Params = Params> = { [K0 in P["tokens"]]?: ColorValue<P> | Reference<P> | Dimension };',
    );
    expect(found).toContain(
      'export type Tokens<P extends Params = Params> = { [K0 in P["tokens"]]: Definition<P> };',
    );
    expect(found).toContain(
      'export type Order<P extends Params = Params> = P["modifiers"][];',
    );
  });

  it("gives a scoped def a key parameter and passes the mapped key at the ref", () => {
    const found = declaration(tokens);
    expect(found).toContain(
      'export type Contexts<P extends Params = Params, K extends string = string> = { [K0 in P["contexts"][K]]: Overrides<P> };',
    );
    expect(found).toContain(
      'export type Modifiers<P extends Params = Params> = { [K0 in P["modifiers"]]: Contexts<P, K0> };',
    );
    expect(found).toContain(
      'export type Input<P extends Params = Params> = { [K0 in P["modifiers"]]: P["contexts"][K0] };',
    );
    expect(found).toContain("  modifiers: Modifiers<P>;");
    expect(found).toContain(
      "export type Kinds<P extends Params = Params> = {\n  token: Token<P>;",
    );
    expect(found).toContain("  value: Value;\n");
  });
});
