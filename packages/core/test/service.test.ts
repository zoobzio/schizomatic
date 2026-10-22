import { describe, expect, it } from "vitest";

import { ArtifactError, SchemaError, makeService } from "../src";
import type { Artifact, Service } from "../src";
import { artifact, options } from "./fixture";
import type { Kinds } from "./fixture";

const schema: Service<Kinds> = makeService<Kinds>(artifact, options);

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const user = { id: uuid, email: "a@b.co", role: "admin" };

describe("makeService", () => {
  it("names the artifact and has every kind in every bundle", () => {
    expect(schema.id).toBe("demo");
    for (const kind of artifact.kinds) {
      expect(typeof schema.check[kind as keyof Kinds]).toBe("function");
      expect(typeof schema.assert[kind as keyof Kinds]).toBe("function");
      expect(typeof schema.parse[kind as keyof Kinds]).toBe("function");
      expect(typeof schema.inspect[kind as keyof Kinds]).toBe("function");
    }
  });

  it("throws an ArtifactError before make when the options do not match", () => {
    expect(() => makeService<Kinds>(artifact, {})).toThrow(ArtifactError);
  });

  it("throws when make returns no validator for a declared kind", () => {
    const broken: Artifact = { ...artifact, make: () => ({}) };
    expect(() => makeService<Kinds>(broken, options)).toThrow(/no validator/);
  });
});

describe("check", () => {
  it("returns a boolean and narrows", () => {
    const v: unknown = user;
    expect(schema.check.user(v)).toBe(true);
    if (schema.check.user(v)) {
      expect(v.role).toBe("admin");
    }
    expect(schema.check.user({ ...user, role: "owner" })).toBe(false);
  });

  it("reads a set param", () => {
    expect(schema.check.role("admin")).toBe(true);
    expect(schema.check.role("other")).toBe(false);
  });
});

describe("assert", () => {
  it("returns for a valid value and throws a SchemaError with every issue", () => {
    expect(() => schema.assert.user(user)).not.toThrow();
    try {
      schema.assert.user({ id: "x", email: "y", role: "z" });
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
  it("returns the output with defaults filled", () => {
    expect(schema.parse.user(user)).toEqual({ ...user, tags: [] });
  });

  it("strips keys the contract does not declare", () => {
    expect(schema.parse.user({ ...user, extra: 1 })).toEqual({
      ...user,
      tags: [],
    });
  });

  it("throws a SchemaError for an invalid value", () => {
    expect(() => schema.parse.priority(["admin", "admin"])).toThrow(
      SchemaError,
    );
  });
});

describe("inspect", () => {
  it("returns a success result with the data", () => {
    const result = schema.inspect.priority(["admin", "viewer", "bot"]);
    expect(result).toEqual({ success: true, data: ["admin", "viewer", "bot"] });
  });

  it("returns a failure result with the issues", () => {
    const result = schema.inspect.priority(["admin"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.message).toBe("Priority must list every role.");
    }
  });
});

describe("params and handlers", () => {
  it("picks the value shape of a key from a map param", () => {
    expect(schema.check.bindings({ admin: { email: "a@b.co" } })).toBe(true);
    expect(schema.check.bindings({ bot: { key: "k", ttl: "1h" } })).toBe(true);
    const result = schema.inspect.bindings({ admin: { key: "k", ttl: "1h" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.path).toEqual(["admin", "email"]);
    }
  });

  it("rejects a key outside the set param", () => {
    expect(schema.check.bindings({ other: { email: "a@b.co" } })).toBe(false);
  });

  it("runs a named handler and keeps its path", () => {
    const result = schema.inspect.bindings({ admin: "<admin>" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const found = result.issues.find(
        (issue) => issue.message === "A role grants itself.",
      );
      expect(found?.path).toEqual(["admin"]);
    }
  });
});
