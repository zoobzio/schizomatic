import { z } from "zod";

import { EXTENSION } from "./constant";
import { isObject, segment } from "./json";
import type { JsonObject, JsonValue, Loaded } from "./types";

/**
 * Removes the extension from a schema and every schema under it. The
 * artifact holds what zod reads and nothing else.
 */
export const strip = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(strip);
  }
  if (!isObject(value)) {
    return value;
  }
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== EXTENSION) {
      out[key] = strip(item);
    }
  }
  return out;
};

/**
 * Returns the defs of the loaded source as the artifact holds them: with the
 * extension removed.
 */
export const defsOf = (loaded: Loaded): Record<string, JsonObject> => {
  const defs: Record<string, JsonObject> = {};
  for (const [name, schema] of Object.entries(loaded.defs)) {
    const found = strip(schema);
    defs[name] = isObject(found) ? found : {};
  }
  return defs;
};

/**
 * Builds each schema of the loaded source with zod, as the service will.
 * A schema that zod cannot build is a problem with the path and the reason
 * zod gives. The build fails on a problem, so the service never meets one.
 *
 * @param loaded - The loaded source.
 */
export const prove = (loaded: Loaded): string[] => {
  const problems: string[] = [];
  const defs = defsOf(loaded);
  for (const path of loaded.schemas) {
    try {
      z.fromJSONSchema({ $ref: `#/$defs/${segment(path)}`, $defs: defs });
    } catch (error) {
      problems.push(
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return problems;
};
