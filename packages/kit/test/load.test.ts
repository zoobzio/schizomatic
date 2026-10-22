import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { KitError, load } from "../src";

const basic = resolve(import.meta.dirname, "fixtures/basic/src");

/** Writes files to a fresh source directory and returns its path. */
const project = (files: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "schizomatic-"));
  for (const [name, json] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof json === "string" ? json : JSON.stringify(json));
  }
  return dir;
};

/** Returns the problems of the error that `run` throws, or `[]`. */
const problems = (run: () => unknown): string[] => {
  try {
    run();
    return [];
  } catch (error) {
    if (error instanceof KitError) {
      return error.problems;
    }
    throw error;
  }
};

/** Strips the directory from each problem. */
const bare = (dir: string, found: string[]): string[] =>
  found.map((problem) => problem.replaceAll(`${dir}/`, ""));

describe("load", () => {
  const loaded = load(basic, "basic");

  it("names each file by its path and hoists every def", () => {
    expect(loaded.id).toBe("basic");
    expect(loaded.schemas).toEqual([
      "audit/log",
      "event",
      "page",
      "tree",
      "user",
    ]);
    expect(Object.keys(loaded.defs).sort()).toEqual([
      "audit/log",
      "created",
      "event",
      "page",
      "role",
      "tree",
      "user",
    ]);
    expect(loaded.defs.role).toEqual({ enum: ["admin", "member"] });
  });

  it("drops the file keywords and reads the check", () => {
    expect(loaded.defs.user?.$schema).toBeUndefined();
    expect(loaded.defs.user?.$defs).toBeUndefined();
    expect(loaded.defs.user?.title).toBe("User");
    expect(loaded.checks).toEqual({ "audit/log": "sorted" });
    expect(loaded.defs["audit/log"]?.["x-schizomatic"]).toBeUndefined();
  });

  it("rewrites each form of $ref into the global defs", () => {
    const page = loaded.defs.page as {
      properties: { items: { items: unknown } };
    };
    expect(page.properties.items.items).toEqual({ $ref: "#/$defs/role" });
    const created = loaded.defs.created as {
      properties: { user: unknown };
    };
    expect(created.properties.user).toEqual({ $ref: "#/$defs/user" });
    const tree = loaded.defs.tree as {
      properties: { children: { items: unknown } };
    };
    expect(tree.properties.children.items).toEqual({ $ref: "#/$defs/tree" });
    const log = loaded.defs["audit/log"] as {
      properties: { actor: unknown };
    };
    expect(log.properties.actor).toEqual({ $ref: "#/$defs/user" });
  });

  it("encodes a nested path in a $ref", () => {
    const dir = project({
      "audit/log.json": { type: "string" },
      "list.json": { type: "array", items: { $ref: "./audit/log.json" } },
    });
    const found = load(dir, "t");
    expect(found.defs.list).toEqual({
      type: "array",
      items: { $ref: "#/$defs/audit~1log" },
    });
  });

  it("keeps a ref inside instance data as it is", () => {
    const dir = project({
      "a.json": { type: "object", default: { $ref: "x" } },
    });
    expect(load(dir, "t").defs.a).toEqual({
      type: "object",
      default: { $ref: "x" },
    });
  });

  it("reports a source that is not a directory", () => {
    const file = join(project({ "a.json": {} }), "a.json");
    expect(problems(() => load(file, "t"))).toEqual([
      `${file}: the source must be a directory`,
    ]);
  });

  it("reports an empty source, bad JSON, and a file that is not an object", () => {
    const empty = project({});
    expect(problems(() => load(empty, "t"))).toEqual([
      `${empty}: the source has no .json file`,
    ]);
    const dir = project({ "a.json": "{", "b.json": [1] });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual([
      expect.stringMatching(/^a\.json: /),
      "b.json: the file must hold a schema object",
    ]);
  });

  it("reports each form of $ref that does not resolve", () => {
    const dir = project({
      "a.json": {
        anyOf: [
          { $ref: "#/properties/x" },
          { $ref: "#/$defs/missing" },
          { $ref: "https://example.com/x.json" },
          { $ref: "./missing.json" },
          { $ref: "./b.json#/properties/x" },
          { $ref: "./b.json#/$defs/missing" },
        ],
      },
      "b.json": { type: "string" },
    });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual([
      'a.json#/anyOf/0: $ref "#/properties/x" must point into $defs',
      'a.json#/anyOf/1: $ref "#/$defs/missing" names no def of the file',
      'a.json#/anyOf/2: $ref "https://example.com/x.json" must be a relative path or point into $defs',
      'a.json#/anyOf/3: $ref "./missing.json" names no file of the source',
      'a.json#/anyOf/4: $ref "./b.json#/properties/x" must point into $defs',
      'a.json#/anyOf/5: $ref "./b.json#/$defs/missing" names no def of b.json',
    ]);
  });

  it("reports a name that two files use", () => {
    const dir = project({
      "a.json": { $defs: { shared: {}, b: {} } },
      "b.json": { $defs: { shared: {} } },
    });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual([
      'b.json: the name "b" is also used by a.json',
      'b.json: the name "shared" is also used by a.json',
    ]);
  });

  it("reports two names that make the same type name", () => {
    const dir = project({
      "audit-log.json": {},
      "audit/log.json": {},
    });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual([
      'audit/log.json: "audit/log" and "audit-log" make the same type name AuditLog',
    ]);
  });

  it("reports a file that is also a directory", () => {
    const dir = project({ "audit.json": {}, "audit/log.json": {} });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual(["audit.json: audit is both a schema and a directory"]);
  });

  it("reports a bad extension", () => {
    const dir = project({
      "a.json": {
        type: "object",
        properties: {
          x: { type: "string", "x-schizomatic": { check: "inner", ts: 1 } },
        },
        "x-schizomatic": { check: "", other: true },
      },
      "b.json": { "x-schizomatic": [] },
    });
    expect(
      bare(
        dir,
        problems(() => load(dir, "t")),
      ),
    ).toEqual([
      "a.json#: check must name a handler",
      "a.json#: x-schizomatic.other is not one of check, ts",
      "a.json#/properties/x: check is allowed at the root of a file only",
      "a.json#/properties/x: ts must be a type",
      "b.json#: x-schizomatic must be an object",
    ]);
  });

  it("skips a dotfile", () => {
    const dir = project({ "a.json": {}, ".b.json": "{", ".hidden/c.json": {} });
    expect(load(dir, "t").schemas).toEqual(["a"]);
  });
});
