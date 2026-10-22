import { describe, expect, it } from "vitest";

import { ArtifactError, SchemaError } from "../src";

describe("SchemaError", () => {
  it("holds every issue and names the path in the message", () => {
    const error = new SchemaError([
      { code: "custom", message: "Expected string.", path: [], input: 1 },
      { code: "custom", message: "Too small.", path: ["user", 0], input: 1 },
    ]);
    expect(error.name).toBe("SchemaError");
    expect(error.issues).toHaveLength(2);
    expect(error.message).toContain("  Expected string.\n");
    expect(error.message).toContain("  Too small. at user.0");
  });
});

describe("ArtifactError", () => {
  it("names the artifact and lists every problem", () => {
    const error = new ArtifactError("demo", [
      "handlers.a is required",
      "b: not supported",
    ]);
    expect(error.name).toBe("ArtifactError");
    expect(error.problems).toHaveLength(2);
    expect(error.message).toContain('"demo"');
    expect(error.message).toContain(
      "  handlers.a is required\n  b: not supported",
    );
  });
});
