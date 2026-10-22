import type { Contract } from "@schizomatic/schema";

/**
 * The config of a schizomatic package. `schizomatic.config.ts` exports it.
 */
export type Config = {
  /* The path of the root JSON Schema document, relative to the project root. */
  source: string;

  /* The identity of the contract. The default is the `$id` of the root document, or the stem of its file name. */
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
  id?: string;
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
 * A JSON Schema as the kit reads it. A boolean schema is `true` or `false`.
 */
export type Schema = JsonObject | boolean;

/**
 * A loaded document. Every file reference is inlined. Every `$defs` of every
 * file is hoisted to the root. Every `$ref` points into the root `$defs`.
 */
export type Document = JsonObject;

/**
 * The outcome of a lowering. The contract is the IR. The problems list every
 * place where the document is not supported.
 */
export type Lowered = {
  contract: Contract;
  problems: string[];
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
  contract: Contract;
  outDir: string;
  files: OutputFile[];
};
