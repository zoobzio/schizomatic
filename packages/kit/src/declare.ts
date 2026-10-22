import { DEFS, EXTENSION } from "./constant";
import { isObject, unsegment } from "./json";
import type { JsonObject, JsonValue, Loaded } from "./types";

const q = (s: string): string => JSON.stringify(s);

/**
 * A name is written bare when it is a valid identifier, else quoted.
 */
const prop = (name: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : q(name);

/**
 * Makes a type name from a name of the source. `audit/event` becomes
 * `AuditEvent`.
 */
export const typeName = (name: string): string => {
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word !== "");
  const joined = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");
  return /^[0-9]/.test(joined) ? `_${joined}` : joined || "_";
};

/**
 * Wraps a type in parentheses when it is a union or an intersection.
 */
const group = (type: string): string =>
  /[|&]/.test(type) && !/^[A-Za-z_$][\w$]*(<.*>)?$/.test(type)
    ? `(${type})`
    : type;

/**
 * Prints the JSDoc for a schema, when it has a description.
 */
const jsdoc = (schema: JsonValue, indent: string): string =>
  isObject(schema) && typeof schema.description === "string"
    ? `${indent}/** ${schema.description.replace(/\*\//g, "* /")} */\n`
    : "";

/**
 * Prints a JSON value as a literal type.
 */
const literal = (value: JsonValue): string => JSON.stringify(value);

/**
 * Prints the type of an array schema. `prefixItems` makes a tuple. An item
 * past `minItems` is optional, as zod reads it. `items` after the prefix is
 * the rest.
 */
const array = (schema: JsonObject, indent: string): string => {
  if (Array.isArray(schema.prefixItems)) {
    const min = typeof schema.minItems === "number" ? schema.minItems : 0;
    const items = schema.prefixItems.map((item, index) =>
      index < min ? type(item, indent) : `${group(type(item, indent))}?`,
    );
    if (isObject(schema.items)) {
      items.push(`...${group(type(schema.items, indent))}[]`);
    }
    return `[${items.join(", ")}]`;
  }
  return schema.items === undefined
    ? "unknown[]"
    : `${group(type(schema.items, indent))}[]`;
};

/**
 * Prints the type of an object schema. A property with a `default` is
 * present in the output, so it is not optional. `additionalProperties` and
 * `patternProperties` make an index signature.
 */
const object = (schema: JsonObject, indent: string): string => {
  const parts: string[] = [];
  const inner = `${indent}  `;
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name) => typeof name === "string")
      : [],
  );
  const properties = isObject(schema.properties) ? schema.properties : {};
  const fields = Object.entries(properties).map(([name, field]) => {
    const optional =
      !required.has(name) && !(isObject(field) && field.default !== undefined);
    return `${jsdoc(field, inner)}${inner}${prop(name)}${optional ? "?" : ""}: ${type(field, inner)};`;
  });
  if (fields.length > 0) {
    parts.push(`{\n${fields.join("\n")}\n${indent}}`);
  }

  const values: string[] = [];
  if (isObject(schema.patternProperties)) {
    for (const pattern of Object.values(schema.patternProperties)) {
      values.push(type(pattern, indent));
    }
  }
  if (isObject(schema.additionalProperties)) {
    values.push(type(schema.additionalProperties, indent));
  }
  if (values.length > 0) {
    parts.push(`{ [key: string]: ${[...new Set(values)].join(" | ")} }`);
  } else if (fields.length === 0) {
    parts.push(
      schema.additionalProperties === false
        ? "Record<string, never>"
        : "{ [key: string]: unknown }",
    );
  }
  return parts.join(" & ");
};

/**
 * Prints the type that the `type` keyword and its companions give a schema.
 * The result is `undefined` when the schema has no type of its own.
 */
const core = (schema: JsonObject, indent: string): string | undefined => {
  const { type: kind } = schema;
  if (Array.isArray(kind)) {
    const names = kind.filter((name) => typeof name === "string");
    const options = names
      .map((name) => core({ ...schema, type: name }, indent))
      .filter((option) => option !== undefined);
    return options.length === 0 ? undefined : options.join(" | ");
  }
  switch (kind) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return array(schema, indent);
    case "object":
      return object(schema, indent);
    case undefined:
      if (
        schema.properties !== undefined ||
        schema.additionalProperties !== undefined ||
        schema.patternProperties !== undefined
      ) {
        return object(schema, indent);
      }
      if (schema.items !== undefined || schema.prefixItems !== undefined) {
        return array(schema, indent);
      }
      return undefined;
    default:
      return "unknown";
  }
};

/**
 * Prints the type of a schema. A `ts` extension replaces the type. A `$ref`
 * prints the type name of its target. `allOf` intersects. `anyOf` and
 * `oneOf` unite. A schema that says nothing is `unknown`.
 */
export const type = (schema: JsonValue, indent = ""): string => {
  if (schema === true) {
    return "unknown";
  }
  if (schema === false) {
    return "never";
  }
  if (!isObject(schema)) {
    return "unknown";
  }
  const ext = schema[EXTENSION];
  if (isObject(ext) && typeof ext.ts === "string") {
    return ext.ts;
  }
  if (typeof schema.$ref === "string" && schema.$ref.startsWith(DEFS)) {
    return typeName(unsegment(schema.$ref.slice(DEFS.length)));
  }
  if (schema.const !== undefined) {
    return literal(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map(literal).join(" | ");
  }
  const parts: string[] = [];
  const own = core(schema, indent);
  if (own !== undefined) {
    parts.push(own);
  }
  if (Array.isArray(schema.allOf)) {
    parts.push(...schema.allOf.map((part) => type(part, indent)));
  }
  const alternation = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(alternation)) {
    parts.push(alternation.map((option) => type(option, indent)).join(" | "));
  }
  if (parts.length === 0) {
    return "unknown";
  }
  return parts.length === 1 ? parts.join("") : parts.map(group).join(" & ");
};

/**
 * A node of the service tree: a path, or the nodes under one directory.
 */
type Node = Map<string, Node | string>;

/**
 * Arranges the schema paths as a tree.
 */
const treeOf = (paths: string[]): Node => {
  const root: Node = new Map();
  for (const path of paths) {
    const segments = path.split("/");
    const leaf = segments.pop();
    if (leaf === undefined) {
      continue;
    }
    let node = root;
    for (const name of segments) {
      let next = node.get(name);
      if (!(next instanceof Map)) {
        next = new Map();
        node.set(name, next);
      }
      node = next;
    }
    node.set(leaf, path);
  }
  return root;
};

/**
 * Prints the service tree as a type. A leaf is a `Validator` of the type of
 * its path.
 */
const tree = (node: Node, indent: string): string => {
  const inner = `${indent}  `;
  const lines = [...node.entries()].map(([name, child]) =>
    typeof child === "string"
      ? `${inner}${prop(name)}: Validator<${typeName(child)}>;`
      : `${inner}${prop(name)}: ${tree(child, inner)};`,
  );
  return `{\n${lines.join("\n")}\n${indent}}`;
};

/**
 * Prints the declaration of an artifact. Each schema and each def becomes an
 * exported type. `Schema` is the service: a `Validator` for each path, in
 * the tree of the source. `Handlers` types each handler by the schema it
 * checks. The default export is the artifact, typed by both.
 *
 * @param loaded - The loaded source.
 */
export const declaration = (loaded: Loaded): string => {
  const defs = Object.entries(loaded.defs).map(
    ([name, schema]) =>
      `${jsdoc(schema, "")}export type ${typeName(name)} = ${type(schema)};`,
  );

  const byHandler = new Map<string, Set<string>>();
  for (const [path, name] of Object.entries(loaded.checks)) {
    const found = byHandler.get(name) ?? new Set();
    found.add(typeName(path));
    byHandler.set(name, found);
  }
  const handlers = [...byHandler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, types]) => `  ${prop(name)}: Handler<${[...types].join(" | ")}>;`,
    );

  return [
    `// Generated by @schizomatic/kit from ${q(loaded.id)}. Do not edit by hand.`,
    `import type { Artifact, Handler, Validator } from "@schizomatic/core";`,
    "",
    ...defs.flatMap((def) => [def, ""]),
    "/** The service: a validator for each schema, in the tree of the source. */",
    `export type Schema = ${tree(treeOf(loaded.schemas), "")};`,
    "",
    "/** The handlers that the service binds at boot, each typed by the schema it checks. */",
    handlers.length === 0
      ? "export type Handlers = Record<never, never>;"
      : `export type Handlers = {\n${handlers.join("\n")}\n};`,
    "",
    `export declare const id: ${q(loaded.id)};`,
    `export declare const schemas: readonly ${JSON.stringify(loaded.schemas)};`,
    `export declare const checks: ${JSON.stringify(loaded.checks)};`,
    `export declare const defs: Artifact["defs"];`,
    "declare const artifact: Artifact<Schema, Handlers>;",
    "export default artifact;",
    "",
  ].join("\n");
};
