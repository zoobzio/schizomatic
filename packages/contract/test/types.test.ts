import { describe, expect, it } from "vitest";

import { FORMATS, NODE_KINDS, PARAM_KINDS, VERSION } from "../src";
import type { Contract, Node } from "../src";

describe("contract", () => {
  it("has one version", () => {
    expect(VERSION).toBe(1);
  });

  it("lists each node kind once", () => {
    expect(new Set(NODE_KINDS).size).toBe(NODE_KINDS.length);
    expect(new Set(FORMATS).size).toBe(FORMATS.length);
    expect(PARAM_KINDS).toEqual(["set", "map"]);
  });

  it("types a contract with a param and a ref", () => {
    const token: Node = { t: "member", param: "tokens" };
    const contract: Contract = {
      id: "demo",
      version: VERSION,
      params: { tokens: { kind: "set" } },
      defs: {
        token,
        overrides: {
          t: "object",
          fields: {},
          extra: "strict",
          keys: { subset: "tokens" },
        },
      },
      kinds: { token: "token", overrides: "overrides" },
      handlers: [],
    };
    expect(contract.kinds.token).toBe("token");
  });
});
