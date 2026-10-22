import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { KitError, load, lowerOrThrow, zodSource } from "../src";
import type { Contract } from "@schizomatic/contract";

const tokens = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/tokens/src/index.json")),
  "tokens",
);
const basic = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/basic/src/index.json")),
);

/** Makes a contract with the given defs and one kind for each. */
const make = (
  defs: Contract["defs"],
  extra: Partial<Contract> = {},
): Contract => ({
  id: "t",
  version: 1,
  defs,
  kinds: Object.fromEntries(Object.keys(defs).map((name) => [name, name])),
  params: {},
  handlers: [],
  ...extra,
});

describe("zodSource", () => {
  it("imports zod/mini and exports the artifact shape", () => {
    const source = zodSource(basic);
    expect(source).toContain('import * as z from "zod/mini";');
    expect(source).toContain('export const id = "basic";');
    expect(source).toContain(
      'export const kinds = Object.freeze(["user","page","event","tree"]);',
    );
    expect(source).toContain("export const make = (params, handlers) => {");
    expect(source).toContain(
      "export default { id, kinds, params, handlers, make };",
    );
  });

  it("emits defs in dependency order", () => {
    const source = zodSource(basic);
    expect(source.indexOf('D["role"] =')).toBeLessThan(
      source.indexOf('D["user"] ='),
    );
    expect(source.indexOf('D["user"] =')).toBeLessThan(
      source.indexOf('D["created"] ='),
    );
  });

  it("uses z.lazy for a recursive def", () => {
    const source = zodSource(basic);
    expect(source).toContain('z.lazy(() => D["tree"])');
  });

  it("emits each scalar and composite", () => {
    const source = zodSource(basic);
    expect(source).toContain("z.uuid()");
    expect(source).toContain("z.email()");
    expect(source).toContain("z.iso.datetime()");
    expect(source).toContain('z.enum(["admin","member"])');
    expect(source).toContain("z.nullable(z.int().check(z.gte(0), z.lte(150)))");
    expect(source).toContain('z.regex(new RegExp("^[A-Z]", "u"))');
    expect(source).toContain(
      "z.array(z.string().check(z.minLength(1))).check(z.maxLength(3), $unique)",
    );
    expect(source).toContain("z._default(");
    expect(source).toContain("z.tuple([z.number(), z.number()])");
    expect(source).toContain(
      "z.record(z.string(), z.number().check(z.multipleOf(0.5)))",
    );
    expect(source).toContain('z.discriminatedUnion("kind", [');
    expect(source).toContain("z.intersection(");
    expect(source).toContain("z.looseObject(");
    expect(source).toContain("z.strictObject(");
  });

  it("binds set params and reads them as enums", () => {
    const source = zodSource(tokens);
    expect(source).toContain('"tokens": new Set(params["tokens"]),');
    expect(source).toContain('D["token"] = z.enum(params["tokens"]);');
    expect(source).toContain(
      '$member(S["tokens"], [1,-1], undefined, undefined)',
    );
    expect(source).toContain(
      '$member(S["tokens"], [1,-1], params["types"], "color")',
    );
  });

  it("emits a scoped def as a factory of the key and passes the key at the ref", () => {
    const source = zodSource(tokens);
    expect(source).toContain(
      'D["contexts"] = (k) => z.catchall(z.looseObject({}), D["overrides"]).check($subset($setOf(params["contexts"], k)), $superset($setOf(params["contexts"], k)));',
    );
    expect(source).toContain(
      'D["modifiers"] = z.looseObject({}).check($keyed((k) => D["contexts"](k)), $subset(S["modifiers"]), $superset(S["modifiers"]));',
    );
    expect(source).toContain(
      '$keyed((k) => z.enum((params["contexts"][k] ?? [])))',
    );
  });

  it("emits valueBy factories, the exhaustive check, and the handler", () => {
    const source = zodSource(tokens);
    expect(source).toContain(
      '$valueBy(params["types"], { "color": (k) => D["colorValue"], "dimension": (k) => z.union([D["reference"], D["dimension"]]) })',
    );
    expect(source).toContain('$exhaustive(S["modifiers"])');
    expect(source).toContain('.check($handler(handlers["acyclic"]))');
  });

  it("rejects a kind that points to a scoped def", () => {
    const contract = make(
      { a: { t: "member", param: { param: "m", at: "$key" } } },
      {
        params: {
          s: { kind: "set" },
          m: { kind: "map", keys: "s", of: "set" },
        },
      },
    );
    expect(() => zodSource(contract)).toThrow(KitError);
    expect(() => zodSource(contract)).toThrow(
      /reads \$key and cannot be a kind/,
    );
  });
});
