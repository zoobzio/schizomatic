import { describe, expect, it } from "vitest";

import { verify } from "../src";
import { artifact, options, sorted } from "./fixture";

describe("verify", () => {
  it("accepts options that bind every check", () => {
    expect(verify(artifact, options)).toEqual([]);
  });

  it("reports a missing handler", () => {
    expect(verify(artifact, {})).toEqual(["handlers.sorted is required"]);
  });

  it("reports a handler that no check names", () => {
    expect(
      verify(artifact, { handlers: { sorted, other: () => undefined } }),
    ).toEqual(["handlers.other is not a check of the artifact"]);
  });

  it("reports a check that names no schema", () => {
    expect(
      verify({ ...artifact, checks: { nowhere: "sorted" } }, options),
    ).toEqual(["checks.nowhere names no schema of the artifact"]);
  });

  it("rejects a handler that is not a function", () => {
    const handlers = { sorted: "no" } as unknown as typeof options.handlers;
    expect(verify(artifact, { handlers })).toEqual([
      "handlers.sorted is required",
    ]);
  });
});
