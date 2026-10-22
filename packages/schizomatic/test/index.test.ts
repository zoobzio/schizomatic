import { describe, expect, it } from "vitest";

import { SchemaError, makeService } from "../src";

describe("schizomatic", () => {
  it("re-exports the core", () => {
    expect(typeof makeService).toBe("function");
    expect(new SchemaError([]).name).toBe("SchemaError");
  });
});
