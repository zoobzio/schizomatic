import { describe, expect, it } from "vitest";

import { defineConfig, CONFIG_FILE, OUT_DIR } from "../src";

describe("defineConfig", () => {
  it("returns the config as it is", () => {
    const config = { source: "./src/index.json" };
    expect(defineConfig(config)).toBe(config);
  });

  it("names the defaults", () => {
    expect(CONFIG_FILE).toBe("schizomatic.config.ts");
    expect(OUT_DIR).toBe(".dist");
  });
});
