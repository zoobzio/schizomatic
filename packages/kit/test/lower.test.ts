import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { KitError, load, lower, lowerOrThrow } from "../src";
import type { Document, JsonObject } from "../src";
import type { Node } from "@schizomatic/schema";

const basic = resolve(import.meta.dirname, "fixtures/basic/src/index.json");
const access = resolve(import.meta.dirname, "fixtures/access/src/index.json");

/** Makes a document with one def `a` and one kind `a`. */
const one = (schema: JsonObject | boolean, ext: JsonObject = {}): Document => ({
  $id: "t",
  "x-schizomatic": { kinds: { a: "a" }, ...ext },
  $defs: { a: schema },
});

const def = (schema: JsonObject | boolean, ext: JsonObject = {}) => {
  const { contract, problems } = lower(one(schema, ext));
  expect(problems).toEqual([]);
  return contract.defs.a as Node;
};

const bad = (schema: JsonObject | boolean, ext: JsonObject = {}): string[] =>
  lower(one(schema, ext)).problems;

describe("lower scalars", () => {
  it("lowers a string with its constraints and format", () => {
    expect(
      def({
        type: "string",
        minLength: 1,
        maxLength: 5,
        pattern: "^a",
        format: "date-time",
      }),
    ).toEqual({
      t: "string",
      min: 1,
      max: 5,
      pattern: "^a",
      format: "datetime",
    });
  });

  it("lowers a number and an integer", () => {
    expect(
      def({
        type: "number",
        minimum: 0,
        exclusiveMaximum: 10,
        multipleOf: 0.5,
      }),
    ).toEqual({
      t: "number",
      min: 0,
      exclusiveMax: 10,
      multipleOf: 0.5,
    });
    expect(def({ type: "integer" })).toEqual({ t: "number", int: true });
  });

  it("lowers boolean, null, const, enum, and true", () => {
    expect(def({ type: "boolean" })).toEqual({ t: "boolean" });
    expect(def({ type: "null" })).toEqual({ t: "null" });
    expect(def(true)).toEqual({ t: "unknown" });
    expect(def({ const: 3 })).toEqual({ t: "literal", value: 3 });
    expect(def({ enum: ["a", 1] })).toEqual({ t: "enum", values: ["a", 1] });
    expect(def({ enum: ["a", null] })).toEqual({
      t: "union",
      options: [
        { t: "literal", value: "a" },
        { t: "literal", value: null },
      ],
    });
  });

  it("lowers a nullable type list", () => {
    expect(def({ type: ["string", "null"] })).toEqual({
      t: "nullable",
      inner: { t: "string" },
    });
    expect(def({ type: ["string", "number"] })).toEqual({
      t: "union",
      options: [{ t: "string" }, { t: "number" }],
    });
  });

  it("keeps description, default, and the ts hint", () => {
    expect(
      def({ type: "string", description: "Doc", default: "x" }, {}),
    ).toEqual({
      t: "default",
      inner: { t: "string" },
      value: "x",
      doc: "Doc",
    });
    expect(
      def({ type: "string", "x-schizomatic": { ts: "`a${string}`" } }),
    ).toEqual({
      t: "string",
      ts: "`a${string}`",
    });
  });
});

describe("lower composites", () => {
  it("lowers an array and a tuple", () => {
    expect(
      def({
        type: "array",
        items: { type: "string" },
        minItems: 1,
        uniqueItems: true,
      }),
    ).toEqual({
      t: "array",
      item: { t: "string" },
      min: 1,
      unique: true,
    });
    expect(
      def({
        type: "array",
        prefixItems: [{ type: "string" }],
        items: { type: "number" },
      }),
    ).toEqual({
      t: "tuple",
      items: [{ t: "string" }],
      rest: { t: "number" },
    });
  });

  it("lowers an object with fields and the extra policy", () => {
    expect(
      def({
        type: "object",
        properties: {
          a: { type: "string", description: "A" },
          b: { type: "number" },
        },
        required: ["a"],
        additionalProperties: false,
      }),
    ).toEqual({
      t: "object",
      fields: {
        a: { node: { t: "string" }, doc: "A" },
        b: { node: { t: "number" }, optional: true },
      },
      extra: "strict",
    });
    expect(
      def({ type: "object", properties: {}, additionalProperties: true }),
    ).toMatchObject({ extra: "passthrough" });
    expect(def({ type: "object", properties: {} })).toMatchObject({
      extra: "strip",
    });
  });

  it("lowers a record and a catchall", () => {
    expect(
      def({ type: "object", additionalProperties: { type: "number" } }),
    ).toEqual({
      t: "record",
      key: { t: "string" },
      value: { t: "number" },
    });
    const found = def({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: { type: "number" },
    });
    expect(found).toMatchObject({
      t: "object",
      extra: "passthrough",
      catchall: { t: "number" },
    });
  });

  it("lowers anyOf, allOf, and a discriminated oneOf", () => {
    expect(def({ anyOf: [{ type: "string" }, { type: "number" }] })).toEqual({
      t: "union",
      options: [{ t: "string" }, { t: "number" }],
    });
    expect(def({ allOf: [{ type: "object" }, { type: "object" }] }).t).toBe(
      "intersection",
    );
    const found = def({
      oneOf: [
        { type: "object", properties: { k: { const: "x" } } },
        { type: "object", properties: { k: { const: "y" } } },
      ],
      "x-schizomatic": { discriminator: "k" },
    });
    expect(found.t).toBe("discriminated");
    if (found.t === "discriminated") {
      expect(Object.keys(found.options)).toEqual(["x", "y"]);
    }
  });

  it("reports a discriminated option without a string const at the tag", () => {
    expect(
      bad({
        oneOf: [{ type: "object" }],
        "x-schizomatic": { discriminator: "k" },
      }),
    ).toEqual([
      '#/$defs/a/oneOf/0: each option must set a string const at "k"',
    ]);
  });
});

describe("lower problems", () => {
  it("reports an unsupported keyword and continues", () => {
    expect(bad({ type: "string", not: {} })).toEqual([
      "#/$defs/a: not is not supported",
    ]);
  });

  it("reports an unknown format, a bad pattern, and a false schema", () => {
    expect(bad({ type: "string", format: "ipv4" })).toEqual([
      '#/$defs/a: format "ipv4" is not supported',
    ]);
    expect(bad({ type: "string", pattern: "(" })[0]).toMatch(
      /not a valid regular expression/,
    );
    expect(bad(false)).toEqual(["#/$defs/a: a false schema is not supported"]);
  });

  it("reports a $ref to no def and a required name that is not a property", () => {
    expect(bad({ $ref: "#/$defs/zzz" })).toEqual([
      '#/$defs/a: $ref "#/$defs/zzz" points to no def',
    ]);
    expect(bad({ type: "object", properties: {}, required: ["x"] })).toEqual([
      '#/$defs/a: required names "x", which is not a property',
    ]);
  });

  it("reports a kind that points to no def and a missing id", () => {
    const { problems } = lower({
      "x-schizomatic": { kinds: { a: "zzz" } },
      $defs: {},
    });
    expect(problems).toEqual([
      '#/x-schizomatic/kinds/a: "zzz" is not a def',
      "#: the root needs an $id, or the config needs an id",
    ]);
    expect(
      lower({ "x-schizomatic": { kinds: { a: "zzz" } }, $defs: {} }, "id")
        .problems,
    ).toHaveLength(1);
  });

  it("reports a param that is not declared or has the wrong kind", () => {
    const params = {
      s: { kind: "set" },
      m: { kind: "map", keys: "s", of: "enum", values: ["x"] },
    };
    expect(
      bad({ type: "string", "x-schizomatic": { member: "zzz" } }, { params }),
    ).toEqual([
      '#/$defs/a: member names the param "zzz", which is not declared',
    ]);
    expect(
      bad({ type: "string", "x-schizomatic": { member: "m" } }, { params }),
    ).toEqual(['#/$defs/a: member names the param "m", which is not a set']);
    expect(
      bad(
        {
          type: "string",
          "x-schizomatic": { member: "s", typed: { param: "m", equals: "y" } },
        },
        { params },
      ),
    ).toEqual(['#/$defs/a: typed.equals "y" is not a value of "m"']);
    expect(
      bad(
        {
          type: "object",
          "x-schizomatic": { valueBy: { param: "m", schemas: { y: {} } } },
        },
        { params },
      ),
    ).toEqual([
      '#/$defs/a: valueBy.schemas names "y", which is not a value of "m"',
    ]);
  });

  it("reports a map param whose keys are not a set", () => {
    const { problems } = lower({
      $id: "t",
      "x-schizomatic": {
        kinds: {},
        params: { m: { kind: "map", keys: "zzz", of: "set" } },
      },
      $defs: {},
    });
    expect(problems).toEqual([
      '#/x-schizomatic/params/m: keys names "zzz", which is not a set param',
    ]);
  });

  it("throws a KitError from lowerOrThrow", () => {
    expect(() => lowerOrThrow(one({ type: "string", not: {} }))).toThrow(
      KitError,
    );
  });
});

describe("lower fixtures", () => {
  it("lowers the basic fixture with no problem", () => {
    const { contract, problems } = lower(load(basic));
    expect(problems).toEqual([]);
    expect(contract.id).toBe("basic");
    expect(Object.keys(contract.kinds)).toEqual([
      "user",
      "page",
      "event",
      "tree",
    ]);
    expect(contract.params).toEqual({});
    expect(contract.handlers).toEqual([]);
  });

  it("lowers the access fixture with its params and handler", () => {
    const { contract, problems } = lower(load(access), "access");
    expect(problems).toEqual([]);
    expect(Object.keys(contract.params)).toEqual([
      "roles",
      "resources",
      "actions",
      "owner",
    ]);
    expect(contract.handlers).toEqual(["noSelfGrant"]);
    expect(contract.defs.permissions).toMatchObject({
      t: "object",
      keys: {
        subset: { param: "actions", at: "$key" },
        superset: { param: "actions", at: "$key" },
      },
    });
    expect(contract.defs.bindings).toMatchObject({
      t: "custom",
      id: "noSelfGrant",
    });
  });
});
