import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";

import { KitError } from "./error";

/**
 * Bundles the zod source of an artifact into one module. The bundle inlines
 * `zod/mini`, so the artifact imports nothing. The source is a virtual entry
 * next to this module, so bare imports resolve from the kit.
 *
 * @param source - The zod source, as {@link zodSource} returns it.
 * @param id - The identity of the artifact, for the virtual file name.
 */
export const bundle = async (source: string, id: string): Promise<string> => {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = resolve(
    here,
    `${id.replace(/[^\w.-]+/g, "_")}.schizomatic.entry.mjs`,
  );
  let build;
  try {
    build = await rolldown({
      input: entry,
      logLevel: "silent",
      treeshake: true,
      plugins: [
        {
          name: "schizomatic:entry",
          resolveId: (source) => (source === entry ? entry : null),
          load: (loaded) => (loaded === entry ? source : null),
        },
      ],
    });
    const { output } = await build.generate({ format: "esm" });
    const chunk = output.find((item) => item.type === "chunk");
    if (chunk === undefined) {
      throw new Error("the bundle has no chunk");
    }
    return chunk.code;
  } catch (error) {
    throw new KitError("the artifact could not be bundled", [
      error instanceof Error ? error.message : String(error),
    ]);
  } finally {
    await build?.close();
  }
};
