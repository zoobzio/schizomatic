import { describe, expect, it } from "vitest";

import { SchemaError } from "../src";

describe("SchemaError", () => {
  it("holds every issue and names the path in the message", () => {
    const error = new SchemaError([
      { code: "not_string", message: "id must be a string." },
      { code: "missing_key", message: "name is required.", path: ["user", 0] },
    ]);
    expect(error.name).toBe("SchemaError");
    expect(error.issues).toHaveLength(2);
    expect(error.message).toContain("id must be a string.");
    expect(error.message).toContain("name is required. at user.0");
  });
});
