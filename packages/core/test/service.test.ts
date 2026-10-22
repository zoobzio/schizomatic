import { describe, expect, it } from "vitest";

import { ArtifactError, SchemaError, makeService } from "../src";
import type { Artifact, Handler } from "../src";
import { artifact, options } from "./fixture";
import type { Schema } from "./fixture";

const schema: Schema = makeService(artifact, options);

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const user = { id: uuid, email: "a@b.co", role: "admin" as const };
const entry = { actor: user, at: "2026-01-01T00:00:00Z", order: [1, 2] };

/** Returns the problems of the error that `run` throws, or `[]`. */
const problems = (run: () => unknown): string[] => {
  try {
    run();
    return [];
  } catch (error) {
    if (error instanceof ArtifactError) {
      return error.problems;
    }
    throw error;
  }
};

describe("makeService", () => {
  it("mirrors the paths of the artifact as a tree of validators", () => {
    for (const leaf of [
      schema.user,
      schema.role,
      schema.tree,
      schema.audit.entry,
    ]) {
      expect(Object.keys(leaf)).toEqual([
        "check",
        "assert",
        "parse",
        "inspect",
      ]);
    }
  });

  it("throws an ArtifactError before it builds when a handler is missing", () => {
    expect(problems(() => makeService(artifact, {}))).toEqual([
      "handlers.sorted is required",
    ]);
  });

  it("reports a document that zod cannot build, with its path", () => {
    const broken: Artifact = {
      ...artifact,
      checks: {},
      schemas: ["user", "odd"],
      defs: { ...artifact.defs, odd: { if: { type: "string" } } },
    };
    expect(problems(() => makeService(broken))).toEqual([
      "odd: Conditional schemas (if/then/else) are not supported",
    ]);
  });

  it("reports a path that is both a schema and a directory", () => {
    const broken: Artifact = {
      ...artifact,
      checks: {},
      schemas: ["audit", "audit/entry"],
      defs: { ...artifact.defs, audit: { type: "object" } },
    };
    expect(problems(() => makeService(broken))).toEqual([
      "audit is both a schema and a directory",
    ]);
  });
});

describe("check", () => {
  it("returns a boolean and narrows", () => {
    const v: unknown = user;
    expect(schema.user.check(v)).toBe(true);
    if (schema.user.check(v)) {
      expect(v.role).toBe("admin");
    }
    expect(schema.user.check({ ...user, role: "owner" })).toBe(false);
  });

  it("validates a nested path", () => {
    expect(schema.audit.entry.check(entry)).toBe(true);
    expect(schema.audit.entry.check({ ...entry, at: "soon" })).toBe(false);
  });
});

describe("assert", () => {
  it("returns for a valid value and throws a SchemaError with every issue", () => {
    expect(() => schema.user.assert(user)).not.toThrow();
    try {
      schema.user.assert({ id: "x", email: "y", role: "z" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const { issues } = error as SchemaError;
      expect(issues.map((issue) => issue.path[0])).toEqual([
        "id",
        "email",
        "role",
      ]);
    }
  });
});

describe("parse", () => {
  it("returns the output with the defaults filled", () => {
    expect(schema.user.parse(user)).toEqual({ ...user, tags: [] });
  });

  it("keeps an extra key, as JSON Schema admits one unless the schema says otherwise", () => {
    expect(schema.user.parse({ ...user, extra: 1 })).toEqual({
      ...user,
      extra: 1,
      tags: [],
    });
    expect(schema.audit.entry.check({ ...entry, extra: 1 })).toBe(false);
  });

  it("follows a recursive ref", () => {
    expect(schema.tree.parse({ value: 1, children: [{ value: 2 }] })).toEqual({
      value: 1,
      children: [{ value: 2, children: [] }],
    });
    expect(() => schema.tree.parse({ value: -1 })).toThrow(SchemaError);
  });
});

describe("inspect", () => {
  it("returns a success result with the data", () => {
    expect(schema.role.inspect("admin")).toEqual({
      success: true,
      data: "admin",
    });
  });

  it("returns a failure result with the issues", () => {
    const result = schema.role.inspect("owner");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.code).toBe("invalid_value");
    }
  });
});

describe("handlers", () => {
  it("runs the handler on the parsed output and keeps each path", () => {
    const result = schema.audit.entry.inspect({ ...entry, order: [3, 1, 2] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => [issue.message, issue.path])).toEqual(
        [["Out of order.", ["order", 1]]],
      );
    }
  });

  it("does not run the handler when zod rejects the value", () => {
    const result = schema.audit.entry.inspect({ ...entry, at: "soon" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        "invalid_format",
      ]);
    }
  });

  it("accepts one problem in place of a list", () => {
    const one: Artifact<Schema, { never: Handler<string> }> = {
      id: artifact.id,
      schemas: artifact.schemas,
      defs: artifact.defs,
      checks: { role: "never" },
    };
    const service: Schema = makeService(one, {
      handlers: { never: () => ({ message: "No." }) },
    });
    const result = service.role.inspect("admin");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.message)).toEqual(["No."]);
    }
  });
});
