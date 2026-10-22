import { describe, expect, it } from "vitest";

import type { Fixture } from "../src";

describe("fixture", () => {
  it("types a fixture", () => {
    const fixture: Fixture = { kind: "user", valid: [{}], invalid: [1] };
    expect(fixture.kind).toBe("user");
  });
});
