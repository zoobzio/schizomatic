/**
 * The config of a schizomatic package. `schizomatic.config.ts` exports it.
 */
export type Config = {
  /* The path of the root JSON Schema document, relative to the project root. */
  source: string;

  /* The identity of the contract. The default is the slug of the source name. */
  id?: string;

  /* The output directory, relative to the project root. The default is `.dist`. */
  outDir?: string;
};

/**
 * A file that the build writes. `path` is relative to the output directory.
 */
export type OutputFile = {
  path: string;
  contents: string;
};
