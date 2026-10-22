import { resolve } from "node:path";

import type { Contract } from "@schizomatic/schema";
import { describe, expect, it } from "vitest";

import { KitError, load, lowerOrThrow, zodSource } from "../src";

const access = lowerOrThrow(
  load(resolve(import.meta.dirname, "fixtures/access/src/index.json")),
  "access",
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
    expect(zodSource(basic)).toContain('z.lazy(() => D["tree"])');
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
    const source = zodSource(access);
    expect(source).toContain('"roles": new Set(params["roles"]),');
    expect(source).toContain('D["role"] = z.enum(params["roles"]);');
    expect(source).toContain(
      '$member(S["roles"], [1,-1], undefined, undefined)',
    );
    expect(source).toContain(
      '$member(S["roles"], [1,-1], params["owner"], "person")',
    );
  });

  it("emits a scoped def as a factory of the key and passes the key at the ref", () => {
    const source = zodSource(access);
    expect(source).toContain(
      'D["permissions"] = (k) => z.catchall(z.looseObject({}), D["bindings"]).check($subset($setOf(params["actions"], k)), $superset($setOf(params["actions"], k)));',
    );
    expect(source).toContain(
      'D["matrix"] = z.looseObject({}).check($keyed((k) => D["permissions"](k)), $subset(S["resources"]), $superset(S["resources"]));',
    );
    expect(source).toContain(
      '$keyed((k) => z.enum((params["actions"][k] ?? [])))',
    );
  });

  it("emits valueBy factories, the exhaustive check, and the handler", () => {
    const source = zodSource(access);
    expect(source).toContain(
      '$valueBy(params["owner"], { "person": (k) => D["personGrant"], "service": (k) => z.union([D["mention"], D["service"]]) })',
    );
    expect(source).toContain('$exhaustive(S["resources"])');
    expect(source).toContain('.check($handler(handlers["noSelfGrant"]))');
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
