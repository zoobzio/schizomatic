import type { JsonObject } from "./types";

/**
 * Checks that a value is a JSON object.
 */
export const isObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Encodes a name as a JSON Pointer segment, as RFC 6901 asks. A `/` in a
 * path such as `audit/event` becomes `~1`.
 */
export const segment = (name: string): string =>
  name.replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * Decodes a JSON Pointer segment to a name.
 */
export const unsegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");
