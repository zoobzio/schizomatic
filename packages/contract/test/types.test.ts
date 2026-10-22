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
    const role: Node = { t: "member", param: "roles" };
    const contract: Contract = {
      id: "demo",
      version: VERSION,
      params: { roles: { kind: "set" } },
      defs: {
        role,
        bindings: {
          t: "object",
          fields: {},
          extra: "strict",
          keys: { subset: "roles" },
        },
      },
      kinds: { role: "role", bindings: "bindings" },
      handlers: [],
    };
    expect(contract.kinds.role).toBe("role");
  });
});
