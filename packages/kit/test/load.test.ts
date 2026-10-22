import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { KitError, load } from "../src";

const basic = resolve(import.meta.dirname, "fixtures/basic/src/index.json");

/** Writes files to a fresh directory and returns the path of the first file. */
const project = (files: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "schizomatic-"));
  for (const [name, json] of Object.entries(files)) {
    writeFileSync(
      join(dir, name),
      typeof json === "string" ? json : JSON.stringify(json),
    );
  }
  return join(dir, Object.keys(files)[0] as string);
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

describe("load", () => {
  it("inlines file references and hoists every $defs to the root", () => {
    const doc = load(basic);
    const defs = doc.$defs as Record<string, Record<string, unknown>>;
    expect(Object.keys(defs).sort()).toEqual([
      "created",
      "event",
      "page",
      "role",
      "tree",
      "user",
    ]);
    expect(defs.user?.type).toBe("object");
    expect(defs.user?.title).toBe("User");
    expect(defs.user?.$defs).toBeUndefined();
    expect(defs.role).toEqual({ enum: ["admin", "member"] });
  });

  it("rewrites a file fragment reference to a root reference", () => {
    const doc = load(basic);
    const page = (doc.$defs as Record<string, Record<string, unknown>>)
      .page as Record<string, Record<string, Record<string, unknown>>>;
    expect(page.properties?.items?.items).toEqual({ $ref: "#/$defs/role" });
  });

  it("lets a sibling keyword replace the one of the file", () => {
    const path = project({
      "root.json": { $defs: { a: { $ref: "./a.json", description: "Mine" } } },
      "a.json": { type: "string", description: "Theirs" },
    });
    const doc = load(path);
    expect((doc.$defs as Record<string, unknown>).a).toEqual({
      type: "string",
      description: "Mine",
    });
  });

  it("resolves a reference relative to the file that holds it", () => {
    const path = project({
      "root.json": { $defs: { a: { $ref: "./a.json" } } },
      "a.json": { type: "object", properties: { b: { $ref: "./b.json" } } },
      "b.json": { type: "number" },
    });
    const doc = load(path);
    const a = (
      doc.$defs as Record<string, Record<string, Record<string, unknown>>>
    ).a;
    expect(a?.properties?.b).toEqual({ type: "number" });
  });

  it("reports two files that define the same def", () => {
    const path = project({
      "root.json": {
        $defs: { a: { $ref: "./a.json" }, x: { type: "string" } },
      },
      "a.json": { type: "string", $defs: { x: { type: "number" } } },
    });
    const found = problems(() => load(path));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/the def "x" is also defined in/);
  });

  it("reports a file that references itself as a whole", () => {
    const path = project({
      "root.json": { $defs: { a: { $ref: "./a.json" } } },
      "a.json": { type: "object", properties: { next: { $ref: "./a.json" } } },
    });
    expect(problems(() => load(path))[0]).toMatch(/references itself/);
  });

  it("reports a missing file and bad JSON with the path", () => {
    const path = project({
      "root.json": {
        $defs: { a: { $ref: "./missing.json" }, b: { $ref: "./bad.json" } },
      },
      "bad.json": "{ not json",
    });
    const found = problems(() => load(path));
    expect(found).toHaveLength(2);
    expect(found[0]).toMatch(/missing\.json: the file could not be read/);
    expect(found[1]).toMatch(/bad\.json: /);
  });

  it("reports a $ref that does not point into $defs", () => {
    const path = project({
      "root.json": { $defs: { a: { $ref: "#/properties/x" } } },
    });
    expect(problems(() => load(path))[0]).toMatch(/must point into \$defs/);
  });

  it("reports a root that is not an object", () => {
    const path = project({ "root.json": [] });
    expect(problems(() => load(path))[0]).toMatch(
      /the root must be a schema object/,
    );
  });
});
