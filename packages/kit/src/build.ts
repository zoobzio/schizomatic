import { loadConfig } from "./config";
import { emit } from "./emit";
import { KitError } from "./error";
import { load } from "./load";
import { prove } from "./prove";
import type { Output, Resolved } from "./types";
import { write } from "./write";

/**
 * Compiles a source directory to its files. The function loads the source,
 * proves each schema with zod, and emits the files. It writes nothing.
 *
 * @param resolved - The resolved config.
 * @throws KitError when a schema does not load or does not build.
 */
export const compile = (resolved: Resolved): Omit<Output, "outDir"> => {
  const loaded = load(resolved.source, resolved.id);
  const problems = prove(loaded);
  if (problems.length > 0) {
    throw new KitError("the source does not build", problems);
  }
  return { loaded, files: emit(loaded) };
};

/**
 * Builds the schema that the config points at. The function loads the config,
 * compiles the source, and writes the files to the output directory.
 *
 * @param options - The project root and the config file, each optional.
 */
export const build = async (
  options: { root?: string; config?: string } = {},
): Promise<Output> => {
  const resolved = await loadConfig(options);
  const compiled = compile(resolved);
  write(compiled.files, resolved.outDir);
  return { ...compiled, outDir: resolved.outDir };
};
