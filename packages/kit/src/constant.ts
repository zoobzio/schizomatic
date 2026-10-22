/* The default config file name. */
export const CONFIG_FILE = "schizomatic.config.ts";

/* The default output directory. */
export const OUT_DIR = ".dist";

/* The file name of the contract in the output directory. */
export const CONTRACT = "contract.json";

/* The file name of the artifact in the output directory. */
export const ARTIFACT = "index.mjs";

/* The file name of the declarations in the output directory. */
export const DECLARATION = "index.d.mts";

/* The extension key that the kit reads in a JSON Schema document. */
export const EXTENSION = "x-schizomatic";

/* The prefix of a `$ref` into the root `$defs`. */
export const DEFS = "#/$defs/";

/* The JSON Schema keywords that the kit does not support. A document that uses one fails the build. */
export const UNSUPPORTED = [
  "patternProperties",
  "dependentSchemas",
  "dependentRequired",
  "if",
  "then",
  "else",
  "not",
  "contains",
  "minContains",
  "maxContains",
  "unevaluatedProperties",
  "unevaluatedItems",
  "$dynamicRef",
  "$dynamicAnchor",
  "$anchor",
  "minProperties",
  "maxProperties",
] as const;

/* The JSON Schema formats the kit maps, and the contract format for each. */
export const FORMAT_MAP = {
  email: "email",
  uuid: "uuid",
  uri: "url",
  url: "url",
  "date-time": "datetime",
  date: "date",
} as const;
