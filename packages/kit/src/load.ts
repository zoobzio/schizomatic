import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import {
  DATA_KEYS,
  DEFS,
  EXTENSION,
  EXTENSION_KEYS,
  FILE_KEYS,
} from "./constant";
import { typeName } from "./declare";
import { KitError } from "./error";
import { isObject, segment, unsegment } from "./json";
import type { JsonObject, JsonValue, Loaded } from "./types";

/**
 * A file of the source. `key` is the path of the file relative to the
 * source, without the extension, such as `audit/event`.
 */
type File = { path: string; key: string; json: JsonObject };

const q = (s: string): string => JSON.stringify(s);

/**
 * Lists every `.json` file under a directory. A file or a directory whose
 * name starts with a dot is skipped. The list is sorted.
 */
const walk = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      found.push(path);
    }
  }
  return found.sort();
};

/**
 * Reads a JSON file. The function reports bad JSON as a problem with the
 * path.
 */
const readJson = (path: string, problems: string[]): JsonValue | undefined => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as JsonValue;
  } catch (error) {
    problems.push(
      `${path}: ${error instanceof Error ? error.message : "bad JSON"}`,
    );
    return undefined;
  }
};

/**
 * Returns the names of the `$defs` of a file.
 */
const defsOf = (file: File): string[] =>
  isObject(file.json.$defs) ? Object.keys(file.json.$defs) : [];

/**
 * Loads a source directory. Every `.json` file under it is a schema. The
 * path of the file, without the extension, names the schema: `audit/event`.
 * The `$defs` of a file are its private parts.
 *
 * The function hoists every schema and every def into one map by name, and
 * rewrites every `$ref` to point into that map:
 *
 * - `#/$defs/name` points to a def of the same file.
 * - `./file.json` points to another file. `../` walks up.
 * - `./file.json#/$defs/name` points to a def of another file.
 *
 * Every name is global. Two files that define the same def, a def that has
 * the name of a file, two names that make the same type name, and a file
 * that is also a directory are each a problem. The function throws a
 * {@link KitError} with every problem.
 *
 * @param source - The absolute path of the source directory.
 * @param id - The identity of the artifact.
 */
export const load = (source: string, id: string): Loaded => {
  const problems: string[] = [];

  let directory = false;
  try {
    directory = statSync(source).isDirectory();
  } catch {
    /* Reported below. */
  }
  if (!directory) {
    throw new KitError("the source could not be loaded", [
      `${source}: the source must be a directory`,
    ]);
  }

  const files: File[] = [];
  const byPath = new Map<string, File>();
  for (const path of walk(source)) {
    const json = readJson(path, problems);
    if (json === undefined) {
      continue;
    }
    if (!isObject(json)) {
      problems.push(`${path}: the file must hold a schema object`);
      continue;
    }
    const key = relative(source, path).slice(0, -".json".length);
    const file: File = { path, key: key.split(sep).join("/"), json };
    files.push(file);
    byPath.set(path, file);
  }
  if (files.length === 0 && problems.length === 0) {
    problems.push(`${source}: the source has no .json file`);
  }

  /* Every schema and every def shares one namespace, and one type namespace. */
  const owner = new Map<string, File>();
  const named = new Map<string, string>();
  const claim = (name: string, file: File): void => {
    const found = owner.get(name);
    if (found !== undefined) {
      problems.push(
        `${file.path}: the name ${q(name)} is also used by ${found.path}`,
      );
      return;
    }
    owner.set(name, file);
    const type = typeName(name);
    const other = named.get(type);
    if (other !== undefined) {
      problems.push(
        `${file.path}: ${q(name)} and ${q(other)} make the same type name ${type}`,
      );
      return;
    }
    named.set(type, name);
  };
  for (const file of files) {
    claim(file.key, file);
    if (file.json.$defs !== undefined && !isObject(file.json.$defs)) {
      problems.push(`${file.path}: $defs must be an object`);
    }
    for (const name of defsOf(file)) {
      claim(name, file);
    }
  }
  for (const file of files) {
    if (files.some((other) => other.key.startsWith(`${file.key}/`))) {
      problems.push(
        `${file.path}: ${file.key} is both a schema and a directory`,
      );
    }
  }

  /* Rewrites a `$ref` to point into the global map. */
  const rewrite = (ref: string, file: File, at: string): string => {
    if (ref.startsWith("#")) {
      if (!ref.startsWith(DEFS)) {
        problems.push(`${at}: $ref ${q(ref)} must point into $defs`);
        return ref;
      }
      const name = unsegment(ref.slice(DEFS.length));
      if (!defsOf(file).includes(name)) {
        problems.push(`${at}: $ref ${q(ref)} names no def of the file`);
      }
      return `${DEFS}${segment(name)}`;
    }
    const hash = ref.indexOf("#");
    const target = hash === -1 ? ref : ref.slice(0, hash);
    const fragment = hash === -1 ? undefined : ref.slice(hash);
    if (!target.startsWith("./") && !target.startsWith("../")) {
      problems.push(
        `${at}: $ref ${q(ref)} must be a relative path or point into $defs`,
      );
      return ref;
    }
    const found = byPath.get(resolve(dirname(file.path), target));
    if (found === undefined) {
      problems.push(`${at}: $ref ${q(ref)} names no file of the source`);
      return ref;
    }
    if (fragment === undefined) {
      return `${DEFS}${segment(found.key)}`;
    }
    if (!fragment.startsWith(DEFS)) {
      problems.push(`${at}: $ref ${q(ref)} must point into $defs`);
      return ref;
    }
    const name = unsegment(fragment.slice(DEFS.length));
    if (!defsOf(found).includes(name)) {
      problems.push(`${at}: $ref ${q(ref)} names no def of ${found.path}`);
    }
    return `${DEFS}${segment(name)}`;
  };

  /* Reads the extension of a schema. `check` is allowed at the root of a file only. */
  const extension = (
    value: JsonValue,
    at: string,
    root: boolean,
  ): string | undefined => {
    if (!isObject(value)) {
      problems.push(`${at}: ${EXTENSION} must be an object`);
      return undefined;
    }
    let check: string | undefined;
    for (const [key, member] of Object.entries(value)) {
      if (key === "check") {
        if (!root) {
          problems.push(`${at}: check is allowed at the root of a file only`);
        } else if (typeof member !== "string" || member.trim() === "") {
          problems.push(`${at}: check must name a handler`);
        } else {
          check = member;
        }
      } else if (key === "ts") {
        if (typeof member !== "string" || member.trim() === "") {
          problems.push(`${at}: ts must be a type`);
        }
      } else {
        problems.push(
          `${at}: ${EXTENSION}.${key} is not one of ${EXTENSION_KEYS.join(", ")}`,
        );
      }
    }
    return check;
  };

  /* Walks a schema. Rewrites each `$ref`. Checks each extension. */
  const visit = (value: JsonValue, file: File, at: string): JsonValue => {
    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, file, `${at}/${index}`));
    }
    if (!isObject(value)) {
      return value;
    }
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string") {
        out[key] = rewrite(item, file, at);
      } else if (key === EXTENSION) {
        extension(item, at, false);
        out[key] = item;
      } else if (DATA_KEYS.some((name) => name === key)) {
        out[key] = item;
      } else {
        out[key] = visit(item, file, `${at}/${key}`);
      }
    }
    return out;
  };

  const defs: Record<string, JsonObject> = {};
  const checks: Record<string, string> = {};
  for (const file of files) {
    const body: JsonObject = {};
    for (const [key, value] of Object.entries(file.json)) {
      if (!FILE_KEYS.some((name) => name === key)) {
        body[key] = value;
      }
    }
    /* The root extension is read here, not by the walk, as `check` is allowed at the root only. */
    const ext = body[EXTENSION];
    delete body[EXTENSION];
    let rest: JsonObject | undefined;
    if (ext !== undefined) {
      const check = extension(ext, `${file.path}#`, true);
      if (check !== undefined) {
        checks[file.key] = check;
      }
      if (isObject(ext)) {
        const others = Object.fromEntries(
          Object.entries(ext).filter(([key]) => key !== "check"),
        );
        if (Object.keys(others).length > 0) {
          rest = others;
        }
      }
    }
    const visited = visit(body, file, `${file.path}#`);
    const schema = isObject(visited) ? visited : {};
    if (rest !== undefined) {
      schema[EXTENSION] = rest;
    }
    defs[file.key] = schema;
    if (isObject(file.json.$defs)) {
      for (const [name, schema] of Object.entries(file.json.$defs)) {
        const found = visit(schema, file, `${file.path}#/$defs/${name}`);
        defs[name] = isObject(found) ? found : {};
        if (!isObject(found)) {
          problems.push(
            `${file.path}#/$defs/${name}: a def must be a schema object`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new KitError("the source could not be loaded", problems);
  }
  return { id, defs, schemas: files.map((file) => file.key), checks };
};
