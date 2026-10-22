import { isAbsolute, relative, resolve } from "node:path";

import { createJiti } from "jiti";

import { CONFIG_FILE, OUT_DIR } from "./constant";
import { KitError } from "./error";
import type { Config, Resolved } from "./types";

/**
 * Types the config of a schizomatic package. The function returns the config
 * as it is.
 */
export const defineConfig = (config: Config): Config => config;

/**
 * Checks a config and fills its defaults. Every path becomes absolute. The
 * function throws a {@link KitError} with every problem.
 *
 * @param config - The config as the file exports it.
 * @param root - The project root. Relative paths of the config resolve from it.
 */
export const resolveConfig = (config: unknown, root: string): Resolved => {
  const problems: string[] = [];
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new KitError("the config is invalid", [
      "the config must be an object",
    ]);
  }
  const { source, id, outDir } = config as Record<string, unknown>;

  if (typeof source !== "string" || source.trim() === "") {
    problems.push("source must be a path to the root JSON Schema document");
  }
  if (id !== undefined && (typeof id !== "string" || id.trim() === "")) {
    problems.push("id must be a non-empty string");
  }
  let out = OUT_DIR;
  if (outDir !== undefined) {
    if (typeof outDir !== "string" || outDir.trim() === "") {
      problems.push("outDir must be a non-empty string");
    } else {
      out = outDir;
      const rel = relative(root, resolve(root, outDir));
      if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
        problems.push(
          `outDir ${JSON.stringify(outDir)} must be a subdirectory of the project root`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new KitError("the config is invalid", problems);
  }
  const resolved: Resolved = {
    root,
    source: resolve(root, source as string),
    outDir: resolve(root, out),
  };
  if (typeof id === "string") {
    resolved.id = id;
  }
  return resolved;
};

/**
 * Loads the config file and resolves it. The file is TypeScript or
 * JavaScript. The default export is the config.
 *
 * @param options - The project root and the config file, each optional.
 */
export const loadConfig = async (
  options: { root?: string; config?: string } = {},
): Promise<Resolved> => {
  const root = resolve(options.root ?? process.cwd());
  const file = resolve(root, options.config ?? CONFIG_FILE);
  const jiti = createJiti(import.meta.url);
  let loaded: unknown;
  try {
    loaded = await jiti.import(file, { default: true });
  } catch (error) {
    throw new KitError("the config could not be loaded", [
      `${file}: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  return resolveConfig(loaded, root);
};
