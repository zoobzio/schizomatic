/* The default config file name. */
export const CONFIG_FILE = "schizomatic.config.ts";

/* The default source directory. */
export const SOURCE = "./src";

/* The default output directory. */
export const OUT_DIR = ".dist";

/* The file name of the artifact in the output directory. */
export const ARTIFACT = "index.mjs";

/* The file name of the declarations in the output directory. */
export const DECLARATION = "index.d.mts";

/* The extension key that the kit reads in a JSON Schema document. */
export const EXTENSION = "x-schizomatic";

/* The members of the extension. `check` names a handler. `ts` replaces the printed type. */
export const EXTENSION_KEYS = ["check", "ts"] as const;

/* The prefix of a `$ref` into `$defs`. */
export const DEFS = "#/$defs/";

/* The keywords of a file that describe the file. The kit drops them from the schema of the file. */
export const FILE_KEYS = ["$schema", "$id", "$defs", "$comment"] as const;

/* The keywords whose value is instance data, not a schema. The kit does not walk them. */
export const DATA_KEYS = ["const", "default", "enum", "examples"] as const;
