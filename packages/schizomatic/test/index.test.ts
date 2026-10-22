import { describe, expect, it } from "vitest";

import { SchemaError, VERSION } from "../src";

describe("schizomatic", () => {
  it("re-exports the contract and the core", () => {
    expect(VERSION).toBe(1);
    expect(new SchemaError([]).name).toBe("SchemaError");
  });
});
