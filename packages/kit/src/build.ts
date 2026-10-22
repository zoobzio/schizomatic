import type { Contract } from "@schizomatic/contract";

import { bundle } from "./bundle";
import { loadConfig } from "./config";
import { emit } from "./emit";
import { load } from "./load";
import { lowerOrThrow } from "./lower";
import type { Output, Resolved } from "./types";
import { write } from "./write";
import { zodSource } from "./zod";

/**
 * Compiles a source document to its files. The function loads the document,
 * lowers it to the contract, emits the zod source, bundles it, and emits the
 * files. It writes nothing.
 *
 * @param resolved - The resolved config.
 */
export const compile = async (
  resolved: Resolved,
): Promise<Omit<Output, "outDir">> => {
  const doc = load(resolved.source);
  const contract: Contract = lowerOrThrow(doc, resolved.id);
  const artifact = await bundle(zodSource(contract), contract.id);
  return { contract, files: emit(contract, artifact) };
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
  const compiled = await compile(resolved);
  write(compiled.files, resolved.outDir);
  return { ...compiled, outDir: resolved.outDir };
};
