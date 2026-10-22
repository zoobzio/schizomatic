import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { DEFS } from "./constant";
import { KitError } from "./error";
import type { Document, JsonObject, JsonValue } from "./types";

/**
 * Checks that a value is a JSON object.
 */
export const isObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The keywords of a file that stay with the file. The kit drops them when it
 * inlines the file.
 */
const FILE_KEYS = new Set(["$schema", "$id", "$defs", "$comment"]);

/**
 * Reads a JSON file. The function reports a missing file and bad JSON as a
 * problem with the path.
 */
const readJson = (path: string, problems: string[]): JsonValue | undefined => {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    problems.push(`${path}: the file could not be read`);
    return undefined;
  }
  try {
    return JSON.parse(text) as JsonValue;
  } catch (error) {
    problems.push(
      `${path}: ${error instanceof Error ? error.message : "bad JSON"}`,
    );
    return undefined;
  }
};

/**
 * Loads the root document and every file that it references. The function
 * inlines each file reference. It hoists the `$defs` of each file to the
 * root. It rewrites each `$ref` to point into the root `$defs`. The result is
 * one document with one `$defs`.
 *
 * A `$ref` has three forms:
 *
 * - `#/$defs/name` points to a def. It stays as it is.
 * - `./file.json` inlines the file. The `$defs` of the file hoist to the
 *   root. A sibling keyword of the `$ref`, such as `description`, replaces
 *   the one of the file.
 * - `./file.json#/$defs/name` loads the file for its `$defs` and points to
 *   the def.
 *
 * Two files that define the same def name are a problem. A file that
 * references itself as a whole is a problem. The function throws a
 * {@link KitError} with every problem.
 *
 * @param path - The absolute path of the root document.
 */
export const load = (path: string): Document => {
  const problems: string[] = [];
  const defs: Record<string, JsonValue> = {};
  const owner: Record<string, string> = {};
  const hoisted = new Set<string>();
  const active = new Set<string>();

  /* Hoists the `$defs` of a file once. Each def is visited from the directory of its file. */
  const hoist = (file: string, doc: JsonObject): void => {
    if (hoisted.has(file)) {
      return;
    }
    hoisted.add(file);
    const own = doc.$defs;
    if (own === undefined) {
      return;
    }
    if (!isObject(own)) {
      problems.push(`${file}: $defs must be an object`);
      return;
    }
    for (const [name, schema] of Object.entries(own)) {
      if (Object.hasOwn(defs, name)) {
        problems.push(
          `${file}: the def ${JSON.stringify(name)} is also defined in ${owner[name]}`,
        );
        continue;
      }
      owner[name] = file;
      defs[name] = visit(schema, dirname(file), `${file}#/$defs/${name}`);
    }
  };

  /* Loads a file and hoists its defs. Returns the file without its file keywords. */
  const open = (file: string, from: string): JsonObject | undefined => {
    const json = readJson(file, problems);
    if (json === undefined) {
      return undefined;
    }
    if (!isObject(json)) {
      problems.push(`${from}: ${file} must hold a schema object`);
      return undefined;
    }
    hoist(file, json);
    const body: JsonObject = {};
    for (const [key, value] of Object.entries(json)) {
      if (!FILE_KEYS.has(key)) {
        body[key] = value;
      }
    }
    return body;
  };

  /* Walks a value. Inlines file references. */
  const visit = (value: JsonValue, dir: string, at: string): JsonValue => {
    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, dir, `${at}/${index}`));
    }
    if (!isObject(value)) {
      return value;
    }
    const { $ref, ...rest } = value;
    if (typeof $ref !== "string") {
      const out: JsonObject = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = visit(item, dir, `${at}/${key}`);
      }
      return out;
    }
    if ($ref.startsWith("#")) {
      if (!$ref.startsWith(DEFS)) {
        problems.push(
          `${at}: $ref ${JSON.stringify($ref)} must point into $defs`,
        );
      }
      const out: JsonObject = { $ref };
      for (const [key, item] of Object.entries(rest)) {
        out[key] = visit(item, dir, `${at}/${key}`);
      }
      return out;
    }
    const hash = $ref.indexOf("#");
    const target = hash === -1 ? $ref : $ref.slice(0, hash);
    const fragment = hash === -1 ? undefined : $ref.slice(hash);
    const file = resolve(dir, target);

    if (fragment !== undefined) {
      if (!fragment.startsWith(DEFS)) {
        problems.push(
          `${at}: $ref ${JSON.stringify($ref)} must point into $defs`,
        );
      }
      const json = readJson(file, problems);
      if (json !== undefined && isObject(json)) {
        hoist(file, json);
      }
      const out: JsonObject = { $ref: fragment };
      for (const [key, item] of Object.entries(rest)) {
        out[key] = visit(item, dir, `${at}/${key}`);
      }
      return out;
    }

    if (active.has(file)) {
      problems.push(
        `${at}: ${file} references itself; use $defs for a recursive schema`,
      );
      return {};
    }
    active.add(file);
    const body = open(file, at);
    const out: JsonObject =
      body === undefined
        ? {}
        : (visit(body, dirname(file), file) as JsonObject);
    active.delete(file);
    for (const [key, item] of Object.entries(rest)) {
      out[key] = visit(item, dir, `${at}/${key}`);
    }
    return out;
  };

  const root = readJson(path, problems);
  if (root === undefined || !isObject(root)) {
    throw new KitError("the source could not be loaded", [
      ...problems,
      ...(root !== undefined && !isObject(root)
        ? [`${path}: the root must be a schema object`]
        : []),
    ]);
  }
  active.add(path);
  hoist(path, root);
  const body: JsonObject = {};
  for (const [key, value] of Object.entries(root)) {
    if (key === "$defs") {
      continue;
    }
    body[key] = visit(value, dirname(path), `${path}#/${key}`);
  }
  active.delete(path);

  if (problems.length > 0) {
    throw new KitError("the source could not be loaded", problems);
  }
  return { ...body, $defs: defs };
};
