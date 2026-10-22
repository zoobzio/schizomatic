import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { OutputFile } from "./types";

/**
 * Writes the files of a build under the output directory. The function makes
 * each directory that a file needs.
 *
 * @param files - The files to write.
 * @param outDir - The absolute output directory.
 */
export const write = (files: OutputFile[], outDir: string): void => {
  for (const file of files) {
    const path = resolve(outDir, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents, "utf8");
  }
};
