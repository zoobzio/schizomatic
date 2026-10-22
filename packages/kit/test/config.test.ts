import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONFIG_FILE,
  KitError,
  OUT_DIR,
  defineConfig,
  loadConfig,
  resolveConfig,
} from "../src";

const root = resolve(import.meta.dirname, "fixtures/basic");

/** Returns the problems of the error that `run` throws, or `[]`. */
const problems = (run: () => unknown): string[] => {
  try {
    run();
    return [];
  } catch (error) {
    if (error instanceof KitError) {
      return error.problems;
    }
    throw error;
  }
};

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

describe("resolveConfig", () => {
  it("fills the defaults and makes the paths absolute", () => {
    const found = resolveConfig({ source: "./src/index.json" }, root);
    expect(found).toEqual({
      root,
      source: resolve(root, "src/index.json"),
      outDir: resolve(root, ".dist"),
    });
  });

  it("keeps the id and the outDir", () => {
    const found = resolveConfig(
      { source: "./src/index.json", id: "app", outDir: "out" },
      root,
    );
    expect(found.id).toBe("app");
    expect(found.outDir).toBe(resolve(root, "out"));
  });

  it("reports every problem together", () => {
    expect(
      problems(() => resolveConfig({ id: "", outDir: "../out" }, root)),
    ).toEqual([
      "source must be a path to the root JSON Schema document",
      "id must be a non-empty string",
      'outDir "../out" must be a subdirectory of the project root',
    ]);
  });

  it("rejects a config that is not an object", () => {
    expect(problems(() => resolveConfig(null, root))).toEqual([
      "the config must be an object",
    ]);
  });

  it("rejects the root as outDir", () => {
    expect(
      problems(() => resolveConfig({ source: "a.json", outDir: "." }, root)),
    ).toHaveLength(1);
  });
});

describe("loadConfig", () => {
  it("loads the config file of a project", async () => {
    const found = await loadConfig({ root });
    expect(found.source).toBe(resolve(root, "src/index.json"));
    expect(found.outDir).toBe(resolve(root, ".generated"));
  });

  it("reports a missing config file", async () => {
    await expect(
      loadConfig({ root, config: "missing.config.ts" }),
    ).rejects.toThrow(/the config could not be loaded/);
  });
});
