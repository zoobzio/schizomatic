import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { defsOf, load, prove, strip } from "../src";

const basic = load(resolve(import.meta.dirname, "fixtures/basic/src"), "basic");

describe("strip", () => {
  it("removes the extension at every depth", () => {
    expect(
      strip({
        type: "object",
        "x-schizomatic": { ts: "A" },
        properties: { a: { type: "string", "x-schizomatic": { ts: "B" } } },
        anyOf: [{ "x-schizomatic": { ts: "C" } }],
      }),
    ).toEqual({
      type: "object",
      properties: { a: { type: "string" } },
      anyOf: [{}],
    });
  });

  it("gives the defs of the artifact", () => {
    const defs = defsOf({
      ...basic,
      defs: { a: { type: "string", "x-schizomatic": { ts: "A" } } },
    });
    expect(defs).toEqual({ a: { type: "string" } });
  });
});

describe("prove", () => {
  it("accepts a source that zod can build", () => {
    expect(prove(basic)).toEqual([]);
  });

  it("reports each schema that zod cannot build, with its path", () => {
    expect(
      prove({
        id: "t",
        schemas: ["ok", "a/b", "c"],
        checks: {},
        defs: {
          ok: { type: "string" },
          "a/b": { if: { type: "string" }, then: {} },
          c: { not: { type: "string" } },
        },
      }),
    ).toEqual([
      "a/b: Conditional schemas (if/then/else) are not supported",
      "c: not is not supported in Zod (except { not: {} } for never)",
    ]);
  });
});
