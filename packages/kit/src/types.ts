/**
 * The config of a schizomatic package. `schizomatic.config.ts` exports it.
 */
export type Config = {
  /* The source directory, relative to the project root. Every `.json` file under it is a schema. The default is `./src`. */
  source?: string;

  /* The identity of the artifact. The default is the name of the project root directory. */
  id?: string;

  /* The output directory, relative to the project root. The default is `.dist`. */
  outDir?: string;
};

/**
 * The config with every default filled and every path absolute.
 */
export type Resolved = {
  root: string;
  source: string;
  id: string;
  outDir: string;
};

/**
 * A JSON value as a document holds it.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * A JSON object.
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * The loaded source. `defs` holds every schema and every def by name, with
 * every `$ref` rewritten to point into it. `schemas` lists the paths of the
 * files, such as `audit/event`, in source order. `checks` names the handler
 * of each schema that declares one.
 */
export type Loaded = {
  id: string;
  defs: Record<string, JsonObject>;
  schemas: string[];
  checks: Record<string, string>;
};

/**
 * A file that the build writes. `path` is relative to the output directory.
 */
export type OutputFile = {
  path: string;
  contents: string;
};

/**
 * The result of a build.
 */
export type Output = {
  loaded: Loaded;
  outDir: string;
  files: OutputFile[];
};
