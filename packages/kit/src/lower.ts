import type {
  Contract,
  Field,
  Format,
  Node,
  Param,
  SetRef,
} from "@schizomatic/contract";
import { VERSION } from "@schizomatic/contract";

import { DEFS, EXTENSION, FORMAT_MAP, UNSUPPORTED } from "./constant";
import { KitError } from "./error";
import { isObject } from "./load";
import type { Document, JsonObject, JsonValue, Lowered } from "./types";

/**
 * The extension of a node, as the document holds it.
 */
type Extension = {
  ts?: string;
  member?: JsonValue;
  slice?: JsonValue;
  typed?: JsonValue;
  keys?: JsonValue;
  valueBy?: JsonValue;
  exhaustive?: JsonValue;
  discriminator?: JsonValue;
  check?: JsonValue;
};

/**
 * The state of a lowering. `problems` collects every place where the
 * document is not supported. `handlers` collects the ids of the checks.
 */
type State = {
  problems: string[];
  handlers: Set<string>;
  params: Record<string, Param>;
  defs: Record<string, JsonValue>;
};

const problem = (state: State, at: string, text: string): void => {
  state.problems.push(`${at}: ${text}`);
};

/**
 * Reads the extension of a schema. A missing extension is empty.
 */
const extension = (schema: JsonObject, state: State, at: string): Extension => {
  const found = schema[EXTENSION];
  if (found === undefined) {
    return {};
  }
  if (!isObject(found)) {
    problem(state, at, `${EXTENSION} must be an object`);
    return {};
  }
  return found as Extension;
};

/**
 * Reads a set reference. A string names a set param. An object names a map
 * param indexed by the enclosing key.
 */
const setRef = (
  value: JsonValue,
  state: State,
  at: string,
  what: string,
): SetRef | undefined => {
  if (typeof value === "string") {
    const param = state.params[value];
    if (param === undefined) {
      problem(
        state,
        at,
        `${what} names the param ${JSON.stringify(value)}, which is not declared`,
      );
      return undefined;
    }
    if (param.kind !== "set") {
      problem(
        state,
        at,
        `${what} names the param ${JSON.stringify(value)}, which is not a set`,
      );
      return undefined;
    }
    return value;
  }
  if (
    isObject(value) &&
    typeof value.param === "string" &&
    value.at === "$key"
  ) {
    const param = state.params[value.param];
    if (param === undefined) {
      problem(
        state,
        at,
        `${what} names the param ${JSON.stringify(value.param)}, which is not declared`,
      );
      return undefined;
    }
    if (param.kind !== "map" || param.of !== "set") {
      problem(
        state,
        at,
        `${what} names the param ${JSON.stringify(value.param)}, which is not a map of sets`,
      );
      return undefined;
    }
    return { param: value.param, at: "$key" };
  }
  problem(
    state,
    at,
    `${what} must name a set param or be { param, at: "$key" }`,
  );
  return undefined;
};

/**
 * Reads a number keyword.
 */
const num = (
  schema: JsonObject,
  key: string,
  state: State,
  at: string,
): number | undefined => {
  const value = schema[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number") {
    problem(state, at, `${key} must be a number`);
    return undefined;
  }
  return value;
};

/**
 * Lowers a string schema.
 */
const string = (schema: JsonObject, state: State, at: string): Node => {
  const node: Node = { t: "string" };
  const min = num(schema, "minLength", state, at);
  const max = num(schema, "maxLength", state, at);
  if (min !== undefined) node.min = min;
  if (max !== undefined) node.max = max;
  if (schema.pattern !== undefined) {
    if (typeof schema.pattern !== "string") {
      problem(state, at, "pattern must be a string");
    } else {
      try {
        new RegExp(schema.pattern, "u");
        node.pattern = schema.pattern;
      } catch {
        problem(
          state,
          at,
          `pattern ${JSON.stringify(schema.pattern)} is not a valid regular expression`,
        );
      }
    }
  }
  if (schema.format !== undefined) {
    const format = (FORMAT_MAP as Record<string, Format>)[
      String(schema.format)
    ];
    if (format === undefined) {
      problem(
        state,
        at,
        `format ${JSON.stringify(schema.format)} is not supported`,
      );
    } else {
      node.format = format;
    }
  }
  return node;
};

/**
 * Lowers a number or integer schema.
 */
const number = (
  schema: JsonObject,
  int: boolean,
  state: State,
  at: string,
): Node => {
  const node: Node = { t: "number" };
  if (int) node.int = true;
  const min = num(schema, "minimum", state, at);
  const max = num(schema, "maximum", state, at);
  const exclusiveMin = num(schema, "exclusiveMinimum", state, at);
  const exclusiveMax = num(schema, "exclusiveMaximum", state, at);
  const multipleOf = num(schema, "multipleOf", state, at);
  if (min !== undefined) node.min = min;
  if (max !== undefined) node.max = max;
  if (exclusiveMin !== undefined) node.exclusiveMin = exclusiveMin;
  if (exclusiveMax !== undefined) node.exclusiveMax = exclusiveMax;
  if (multipleOf !== undefined) node.multipleOf = multipleOf;
  return node;
};

/**
 * Lowers an array schema. `prefixItems` makes a tuple.
 */
const array = (
  schema: JsonObject,
  ext: Extension,
  state: State,
  at: string,
): Node => {
  if (schema.prefixItems !== undefined) {
    if (!Array.isArray(schema.prefixItems)) {
      problem(state, at, "prefixItems must be an array");
      return { t: "unknown" };
    }
    const items = schema.prefixItems.map((item, index) =>
      node(item, state, `${at}/prefixItems/${index}`),
    );
    const tuple: Node = { t: "tuple", items };
    if (schema.items !== undefined && schema.items !== false) {
      tuple.rest = node(schema.items, state, `${at}/items`);
    }
    return tuple;
  }
  const item =
    schema.items === undefined
      ? { t: "unknown" as const }
      : node(schema.items, state, `${at}/items`);
  const found: Node = { t: "array", item };
  const min = num(schema, "minItems", state, at);
  const max = num(schema, "maxItems", state, at);
  if (min !== undefined) found.min = min;
  if (max !== undefined) found.max = max;
  if (schema.uniqueItems === true) found.unique = true;
  if (ext.exhaustive !== undefined) {
    const ref = setRef(ext.exhaustive, state, at, "exhaustive");
    if (ref !== undefined) found.exhaustive = ref;
  }
  return found;
};

/**
 * Lowers an object schema. A schema with `properties`, `keys`, `valueBy`, or
 * `propertyNames` is an `object` node. A schema with only `additionalProperties`
 * is a `record` node.
 */
const object = (
  schema: JsonObject,
  ext: Extension,
  state: State,
  at: string,
): Node => {
  const { properties, required, additionalProperties, propertyNames } = schema;
  const extra =
    additionalProperties === false
      ? "strict"
      : additionalProperties === true
        ? "passthrough"
        : isObject(additionalProperties)
          ? "catchall"
          : "none";

  const keyed =
    ext.keys !== undefined ||
    ext.valueBy !== undefined ||
    propertyNames !== undefined;
  if (properties === undefined && !keyed && extra === "catchall") {
    return {
      t: "record",
      key: { t: "string" },
      value: node(
        additionalProperties as JsonObject,
        state,
        `${at}/additionalProperties`,
      ),
    };
  }

  const fields: Record<string, Field> = {};
  const needed = new Set<string>();
  if (required !== undefined) {
    if (
      !Array.isArray(required) ||
      !required.every((name) => typeof name === "string")
    ) {
      problem(state, at, "required must be an array of strings");
    } else {
      for (const name of required) needed.add(name as string);
    }
  }
  if (properties !== undefined) {
    if (!isObject(properties)) {
      problem(state, at, "properties must be an object");
    } else {
      for (const [name, schema] of Object.entries(properties)) {
        const inner = node(schema, state, `${at}/properties/${name}`);
        const field: Field = { node: inner };
        if (!needed.has(name)) field.optional = true;
        if (inner.doc !== undefined) {
          field.doc = inner.doc;
          delete inner.doc;
        }
        fields[name] = field;
        needed.delete(name);
      }
    }
  }
  for (const name of needed) {
    problem(
      state,
      at,
      `required names ${JSON.stringify(name)}, which is not a property`,
    );
  }

  const found: Node = {
    t: "object",
    fields,
    /* A JSON Schema object admits extra keys. The build strips them, as zod does, unless the schema says otherwise. */
    extra:
      extra === "strict"
        ? "strict"
        : extra === "passthrough"
          ? "passthrough"
          : keyed && extra === "none"
            ? "passthrough"
            : "strip",
  };
  if (extra === "catchall") {
    found.catchall = node(
      additionalProperties as JsonObject,
      state,
      `${at}/additionalProperties`,
    );
    found.extra = "passthrough";
  }
  if (propertyNames !== undefined) {
    found.names = node(propertyNames, state, `${at}/propertyNames`);
  }
  if (ext.keys !== undefined) {
    if (!isObject(ext.keys)) {
      problem(state, at, "keys must be an object with subset or superset");
    } else {
      const keys: { subset?: SetRef; superset?: SetRef } = {};
      if (ext.keys.subset !== undefined) {
        const ref = setRef(ext.keys.subset, state, at, "keys.subset");
        if (ref !== undefined) keys.subset = ref;
      }
      if (ext.keys.superset !== undefined) {
        const ref = setRef(ext.keys.superset, state, at, "keys.superset");
        if (ref !== undefined) keys.superset = ref;
      }
      if (ext.keys.exact !== undefined) {
        const ref = setRef(ext.keys.exact, state, at, "keys.exact");
        if (ref !== undefined) {
          keys.subset = ref;
          keys.superset = ref;
        }
      }
      found.keys = keys;
    }
  }
  if (ext.valueBy !== undefined) {
    const valueBy = ext.valueBy;
    if (
      !isObject(valueBy) ||
      typeof valueBy.param !== "string" ||
      !isObject(valueBy.schemas)
    ) {
      problem(state, at, "valueBy must be { param, schemas }");
    } else {
      const param = state.params[valueBy.param];
      if (param === undefined || param.kind !== "map" || param.of !== "enum") {
        problem(
          state,
          at,
          `valueBy names the param ${JSON.stringify(valueBy.param)}, which is not a map of enum values`,
        );
      } else {
        const schemas: Record<string, Node> = {};
        for (const [value, schema] of Object.entries(valueBy.schemas)) {
          if (!param.values.includes(value)) {
            problem(
              state,
              at,
              `valueBy.schemas names ${JSON.stringify(value)}, which is not a value of ${JSON.stringify(valueBy.param)}`,
            );
            continue;
          }
          schemas[value] = node(
            schema,
            state,
            `${at}/${EXTENSION}/valueBy/schemas/${value}`,
          );
        }
        found.valueBy = { param: valueBy.param, schemas };
      }
    }
  }
  return found;
};

/**
 * Lowers an enum keyword. Strings and numbers make an `enum` node. Any other
 * member makes a union of literals.
 */
const enumeration = (values: JsonValue, state: State, at: string): Node => {
  if (!Array.isArray(values) || values.length === 0) {
    problem(state, at, "enum must be a non-empty array");
    return { t: "unknown" };
  }
  if (
    values.every(
      (value) => typeof value === "string" || typeof value === "number",
    )
  ) {
    return { t: "enum", values: values as (string | number)[] };
  }
  const options: Node[] = [];
  for (const [index, value] of values.entries()) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      options.push({ t: "literal", value });
    } else {
      problem(
        state,
        at,
        `enum member ${index} must be a string, a number, a boolean, or null`,
      );
    }
  }
  return options.length === 1 ? (options[0] as Node) : { t: "union", options };
};

/**
 * Lowers a discriminated union. Each option must be an object schema, or a
 * ref to one, with a `const` at the tag.
 */
const discriminated = (
  options: JsonValue[],
  tag: string,
  state: State,
  at: string,
): Node => {
  const found: Record<string, Node> = {};
  for (const [index, option] of options.entries()) {
    const where = `${at}/${index}`;
    const lowered = node(option, state, where);
    let raw: JsonValue = option;
    if (isObject(option) && typeof option.$ref === "string") {
      raw = state.defs[option.$ref.slice(DEFS.length)] ?? {};
    }
    const value =
      isObject(raw) && isObject(raw.properties) && isObject(raw.properties[tag])
        ? (raw.properties[tag] as JsonObject).const
        : undefined;
    if (typeof value !== "string") {
      problem(
        state,
        where,
        `each option must set a string const at ${JSON.stringify(tag)}`,
      );
      continue;
    }
    if (Object.hasOwn(found, value)) {
      problem(state, where, `the tag ${JSON.stringify(value)} is used twice`);
      continue;
    }
    found[value] = lowered;
  }
  return { t: "discriminated", tag, options: found };
};

/**
 * Lowers a schema to a node. The function reports each unsupported keyword
 * as a problem and continues.
 */
export const node = (schema: JsonValue, state: State, at: string): Node => {
  if (schema === true) {
    return { t: "unknown" };
  }
  if (schema === false) {
    problem(state, at, "a false schema is not supported");
    return { t: "unknown" };
  }
  if (!isObject(schema)) {
    problem(state, at, "a schema must be an object or a boolean");
    return { t: "unknown" };
  }
  for (const key of UNSUPPORTED) {
    if (schema[key] !== undefined) {
      problem(state, at, `${key} is not supported`);
    }
  }
  const ext = extension(schema, state, at);

  let found = core(schema, ext, state, at);

  if (schema.default !== undefined) {
    found = { t: "default", inner: found, value: schema.default };
  }
  if (ext.check !== undefined) {
    if (typeof ext.check !== "string" || ext.check.trim() === "") {
      problem(state, at, "check must name a handler");
    } else {
      state.handlers.add(ext.check);
      found = { t: "custom", id: ext.check, inner: found };
    }
  }
  if (typeof schema.description === "string") {
    found.doc = schema.description;
  }
  if (ext.ts !== undefined) {
    if (typeof ext.ts !== "string") {
      problem(state, at, "ts must be a string");
    } else {
      found.ts = ext.ts;
    }
  }
  return found;
};

/**
 * Lowers the core of a schema, before `default`, `check`, and the hints.
 */
const core = (
  schema: JsonObject,
  ext: Extension,
  state: State,
  at: string,
): Node => {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.slice(DEFS.length);
    if (!Object.hasOwn(state.defs, name)) {
      problem(
        state,
        at,
        `$ref ${JSON.stringify(schema.$ref)} points to no def`,
      );
    }
    return { t: "ref", name };
  }
  if (ext.member !== undefined) {
    if (schema.type !== undefined && schema.type !== "string") {
      problem(state, at, "a member must have type string");
    }
    const ref = setRef(ext.member, state, at, "member");
    const found: Node = { t: "member", param: ref ?? "" };
    if (ext.slice !== undefined) {
      if (
        !Array.isArray(ext.slice) ||
        ext.slice.length !== 2 ||
        !ext.slice.every((n) => typeof n === "number")
      ) {
        problem(state, at, "slice must be [start, end]");
      } else {
        found.slice = ext.slice as [number, number];
      }
    }
    if (ext.typed !== undefined) {
      const typed = ext.typed;
      if (
        !isObject(typed) ||
        typeof typed.param !== "string" ||
        typeof typed.equals !== "string"
      ) {
        problem(state, at, "typed must be { param, equals }");
      } else {
        const param = state.params[typed.param];
        if (
          param === undefined ||
          param.kind !== "map" ||
          param.of !== "enum"
        ) {
          problem(
            state,
            at,
            `typed names the param ${JSON.stringify(typed.param)}, which is not a map of enum values`,
          );
        } else if (!param.values.includes(typed.equals)) {
          problem(
            state,
            at,
            `typed.equals ${JSON.stringify(typed.equals)} is not a value of ${JSON.stringify(typed.param)}`,
          );
        } else {
          found.typed = { param: typed.param, equals: typed.equals };
        }
      }
    }
    return found;
  }
  if (schema.const !== undefined) {
    const value = schema.const;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      return { t: "literal", value };
    }
    problem(state, at, "const must be a string, a number, a boolean, or null");
    return { t: "unknown" };
  }
  if (schema.enum !== undefined) {
    return enumeration(schema.enum, state, at);
  }
  const alternation = schema.anyOf ?? schema.oneOf;
  if (alternation !== undefined) {
    const key = schema.anyOf !== undefined ? "anyOf" : "oneOf";
    if (!Array.isArray(alternation) || alternation.length === 0) {
      problem(state, at, `${key} must be a non-empty array`);
      return { t: "unknown" };
    }
    if (ext.discriminator !== undefined) {
      if (typeof ext.discriminator !== "string") {
        problem(state, at, "discriminator must be a string");
      } else {
        return discriminated(
          alternation,
          ext.discriminator,
          state,
          `${at}/${key}`,
        );
      }
    }
    const options = alternation.map((option, index) =>
      node(option, state, `${at}/${key}/${index}`),
    );
    return options.length === 1
      ? (options[0] as Node)
      : { t: "union", options };
  }
  if (schema.allOf !== undefined) {
    if (!Array.isArray(schema.allOf) || schema.allOf.length === 0) {
      problem(state, at, "allOf must be a non-empty array");
      return { t: "unknown" };
    }
    const parts = schema.allOf.map((part, index) =>
      node(part, state, `${at}/allOf/${index}`),
    );
    return parts.length === 1
      ? (parts[0] as Node)
      : { t: "intersection", parts };
  }

  const { type } = schema;
  if (Array.isArray(type)) {
    const names = type.filter(
      (name): name is string => typeof name === "string",
    );
    const others = names.filter((name) => name !== "null");
    if (names.length !== type.length) {
      problem(state, at, "type must be a string or an array of strings");
    }
    const options = others.map((name) =>
      core({ ...schema, type: name }, ext, state, at),
    );
    const inner =
      options.length === 1
        ? (options[0] as Node)
        : { t: "union" as const, options };
    if (names.includes("null")) {
      return others.length === 0 ? { t: "null" } : { t: "nullable", inner };
    }
    return inner;
  }
  switch (type) {
    case undefined:
      if (
        schema.properties !== undefined ||
        schema.additionalProperties !== undefined ||
        ext.keys !== undefined ||
        ext.valueBy !== undefined
      ) {
        return object(schema, ext, state, at);
      }
      if (schema.items !== undefined || schema.prefixItems !== undefined) {
        return array(schema, ext, state, at);
      }
      return { t: "unknown" };
    case "string":
      return string(schema, state, at);
    case "number":
      return number(schema, false, state, at);
    case "integer":
      return number(schema, true, state, at);
    case "boolean":
      return { t: "boolean" };
    case "null":
      return { t: "null" };
    case "array":
      return array(schema, ext, state, at);
    case "object":
      return object(schema, ext, state, at);
    default:
      problem(state, at, `type ${JSON.stringify(type)} is not supported`);
      return { t: "unknown" };
  }
};

/**
 * Reads the params of the root extension.
 */
const params = (
  value: JsonValue | undefined,
  state: State,
  at: string,
): Record<string, Param> => {
  const found: Record<string, Param> = {};
  if (value === undefined) {
    return found;
  }
  if (!isObject(value)) {
    problem(state, at, "params must be an object");
    return found;
  }
  for (const [name, param] of Object.entries(value)) {
    const where = `${at}/${name}`;
    if (!isObject(param)) {
      problem(state, where, "a param must be an object");
      continue;
    }
    if (param.kind === "set") {
      found[name] = { kind: "set" };
      continue;
    }
    if (param.kind === "map") {
      if (typeof param.keys !== "string") {
        problem(state, where, "a map param must name its keys");
        continue;
      }
      if (param.of === "set") {
        found[name] = { kind: "map", keys: param.keys, of: "set" };
        continue;
      }
      if (param.of === "enum") {
        if (
          !Array.isArray(param.values) ||
          !param.values.every((v) => typeof v === "string")
        ) {
          problem(state, where, "a map of enum values must list its values");
          continue;
        }
        found[name] = {
          kind: "map",
          keys: param.keys,
          of: "enum",
          values: param.values as string[],
        };
        continue;
      }
      problem(state, where, 'a map param must be of "set" or "enum"');
      continue;
    }
    problem(state, where, 'a param must have kind "set" or "map"');
  }
  for (const [name, param] of Object.entries(found)) {
    if (param.kind === "map" && found[param.keys]?.kind !== "set") {
      problem(
        state,
        `${at}/${name}`,
        `keys names ${JSON.stringify(param.keys)}, which is not a set param`,
      );
    }
  }
  return found;
};

/**
 * Lowers a loaded document to a contract. The root extension declares the
 * `params` and the `kinds`. Each def in `$defs` becomes a def of the
 * contract. The function returns every problem with the contract. A document
 * with problems has no usable contract.
 *
 * @param doc - The document as {@link load} returns it.
 * @param id - The identity of the contract. The default is the `$id` of the
 *   document.
 */
export const lower = (doc: Document, id?: string): Lowered => {
  const state: State = {
    problems: [],
    handlers: new Set(),
    params: {},
    defs: isObject(doc.$defs) ? doc.$defs : {},
  };
  const at = "#";
  const ext = extension(doc, state, at);
  const root = ext as Record<string, JsonValue>;

  state.params = params(root.params, state, `${at}/${EXTENSION}/params`);

  const defs: Record<string, Node> = {};
  for (const [name, schema] of Object.entries(state.defs)) {
    defs[name] = node(schema, state, `${DEFS}${name}`);
  }

  const kinds: Record<string, string> = {};
  if (root.kinds === undefined) {
    problem(state, `${at}/${EXTENSION}`, "kinds is required");
  } else if (!isObject(root.kinds)) {
    problem(
      state,
      `${at}/${EXTENSION}/kinds`,
      "kinds must map each kind to a def name",
    );
  } else {
    for (const [kind, name] of Object.entries(root.kinds)) {
      const target =
        typeof name === "string" && name.startsWith(DEFS)
          ? name.slice(DEFS.length)
          : name;
      if (typeof target !== "string" || !Object.hasOwn(defs, target)) {
        problem(
          state,
          `${at}/${EXTENSION}/kinds/${kind}`,
          `${JSON.stringify(name)} is not a def`,
        );
        continue;
      }
      kinds[kind] = target;
    }
  }

  const identity = id ?? (typeof doc.$id === "string" ? doc.$id : undefined);
  if (identity === undefined) {
    problem(state, at, "the root needs an $id, or the config needs an id");
  }

  return {
    contract: {
      id: identity ?? "",
      version: VERSION,
      defs,
      kinds,
      params: state.params,
      handlers: [...state.handlers].sort(),
    },
    problems: state.problems,
  };
};

/**
 * Lowers a document and throws a {@link KitError} when it has problems.
 */
export const lowerOrThrow = (doc: Document, id?: string): Contract => {
  const { contract, problems } = lower(doc, id);
  if (problems.length > 0) {
    throw new KitError("the source is not supported", problems);
  }
  return contract;
};
