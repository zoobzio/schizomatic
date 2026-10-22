import { describe, expect, it } from "vitest";

import { ArtifactError, verify } from "../src";
import { acyclic, artifact, params } from "./fixture";

/** Returns the problems of the error that `verify` throws, or `[]`. */
const problems = (run: () => void): string[] => {
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

describe("verify", () => {
  it("accepts options that bind every param and handler", () => {
    expect(
      problems(() => verify(artifact, { params, handlers: { acyclic } })),
    ).toEqual([]);
  });

  it("reports a missing param and a missing handler together", () => {
    expect(problems(() => verify(artifact, {}))).toEqual([
      "params.tokens is required",
      "params.types is required",
      "handlers.acyclic is required",
    ]);
  });

  it("reports a param and a handler that the artifact does not declare", () => {
    const found = problems(() =>
      verify(artifact, {
        params: { ...params, extra: [] },
        handlers: { acyclic, other: () => undefined },
      }),
    );
    expect(found).toEqual([
      "params.extra is not a param of the artifact",
      "handlers.other is not a handler of the artifact",
    ]);
  });

  it("rejects a handler that is not a function", () => {
    const handlers = { acyclic: "no" } as unknown as Record<
      string,
      () => undefined
    >;
    expect(problems(() => verify(artifact, { params, handlers }))).toEqual([
      "handlers.acyclic is required",
    ]);
  });
});
