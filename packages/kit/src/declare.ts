import type { Contract, Node, SetRef } from "@schizomatic/contract";

import { generic, scoped, settle } from "./scope";

/**
 * The scope of a type. `key` is a type expression for the key of the nearest
 * enclosing entry. `depth` numbers the mapped type variables.
 */
type Scope = { key?: string; depth: number };

/**
 * The state of a printing. `generic` says whether a def reads a param.
 * `scoped` says whether a def reads the enclosing key.
 */
type State = {
  contract: Contract;
  generic: Set<string>;
  scoped: Set<string>;
};

const q = (s: string): string => JSON.stringify(s);

/**
 * A name is written bare when it is a valid identifier, else quoted.
 */
const prop = (name: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : q(name);

/**
 * Makes a type name from a def name. `color.bg` becomes `ColorBg`.
 */
export const typeName = (name: string): string => {
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word !== "");
  const joined = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");
  return /^[0-9]/.test(joined) ? `_${joined}` : joined || "_";
};

/**
 * Prints the type of a set reference.
 */
const setType = (ref: SetRef, scope: Scope): string => {
  if (typeof ref === "string") {
    return `P[${q(ref)}]`;
  }
  return `P[${q(ref.param)}][${scope.key ?? "string"}]`;
};

/**
 * Wraps a type in parentheses when it is a union or an intersection.
 */
const group = (type: string): string =>
  /[|&]/.test(type) && !/^[A-Za-z_$][\w$]*(<.*>)?$/.test(type)
    ? `(${type})`
    : type;

/**
 * Prints the JSDoc for a node, when it has a doc.
 */
const jsdoc = (doc: string | undefined, indent: string): string =>
  doc === undefined ? "" : `${indent}/** ${doc.replace(/\*\//g, "* /")} */\n`;

/**
 * Prints the generic arguments of a ref.
 */
const args = (name: string, scope: Scope, state: State): string => {
  const list: string[] = [];
  if (state.generic.has(name)) list.push("P");
  if (state.scoped.has(name)) list.push(scope.key ?? "string");
  return list.length === 0 ? "" : `<${list.join(", ")}>`;
};

/**
 * Prints the type of a node.
 */
export const type = (
  node: Node,
  scope: Scope,
  state: State,
  indent = "",
): string => {
  if (node.ts !== undefined) {
    return node.ts;
  }
  switch (node.t) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "unknown":
      return "unknown";
    case "literal":
      return JSON.stringify(node.value);
    case "enum":
      return node.values.map((value) => JSON.stringify(value)).join(" | ");
    case "array":
      return `${group(type(node.item, scope, state, indent))}[]`;
    case "tuple": {
      const items = node.items.map((item) => type(item, scope, state, indent));
      if (node.rest !== undefined) {
        items.push(`...${group(type(node.rest, scope, state, indent))}[]`);
      }
      return `[${items.join(", ")}]`;
    }
    case "object": {
      const parts: string[] = [];
      const inner = `${indent}  `;
      const fields = Object.entries(node.fields);
      if (fields.length > 0) {
        const lines = fields.map(([name, field]) => {
          const value = type(
            field.node,
            { key: q(name), depth: scope.depth },
            state,
            inner,
          );
          const optional = field.optional && field.node.t !== "default";
          return `${jsdoc(field.doc, inner)}${inner}${prop(name)}${optional ? "?" : ""}: ${value};`;
        });
        parts.push(`{\n${lines.join("\n")}\n${indent}}`);
      }
      const variable = `K${scope.depth}`;
      const entry: Scope = { key: variable, depth: scope.depth + 1 };
      const keyed = node.keys?.subset ?? node.keys?.superset;
      const values: string[] = [];
      if (node.catchall !== undefined)
        values.push(type(node.catchall, entry, state, inner));
      if (node.valueBy !== undefined) {
        for (const schema of Object.values(node.valueBy.schemas))
          values.push(type(schema, entry, state, inner));
      }
      const value =
        values.length === 0 ? "unknown" : [...new Set(values)].join(" | ");
      if (keyed !== undefined) {
        const optional = node.keys?.superset === undefined ? "?" : "";
        parts.push(
          `{ [${variable} in ${setType(keyed, scope)}]${optional}: ${value} }`,
        );
      } else if (values.length > 0 || fields.length === 0) {
        parts.push(`{ [${variable} in string]: ${value} }`);
      }
      return parts.join(" & ") || "{}";
    }
    case "record": {
      const variable = `K${scope.depth}`;
      const value = type(
        node.value,
        { key: variable, depth: scope.depth + 1 },
        state,
        indent,
      );
      return `{ [${variable} in ${type(node.key, scope, state, indent)}]: ${value} }`;
    }
    case "union":
      return node.options
        .map((option) => type(option, scope, state, indent))
        .join(" | ");
    case "discriminated":
      return Object.values(node.options)
        .map((option) => type(option, scope, state, indent))
        .join(" | ");
    case "intersection":
      return node.parts
        .map((part) => group(type(part, scope, state, indent)))
        .join(" & ");
    case "optional":
      return `${type(node.inner, scope, state, indent)} | undefined`;
    case "nullable":
      return `${type(node.inner, scope, state, indent)} | null`;
    case "default":
    case "custom":
      return type(node.inner, scope, state, indent);
    case "ref":
      return `${typeName(node.name)}${args(node.name, scope, state)}`;
    case "member":
      return setType(node.param, scope);
  }
};

/**
 * Prints the declarations of an artifact. Each def becomes an exported type.
 * A def that reads a param takes `P extends Params`. A def that reads the
 * enclosing key takes `K extends string` too. `Kinds` maps each kind to its
 * type. The default export is the artifact.
 *
 * @param contract - The contract to print.
 */
export const declaration = (contract: Contract): string => {
  const state: State = {
    contract,
    generic: settle(contract, generic),
    scoped: settle(contract, scoped),
  };

  const hasParams = Object.keys(contract.params).length > 0;
  const paramsType = Object.entries(contract.params)
    .map(
      ([name, param]) =>
        `  ${prop(name)}: ${param.kind === "set" ? "string" : "Record<string, string>"};`,
    )
    .join("\n");

  const defs = Object.entries(contract.defs).map(([name, node]) => {
    const generics: string[] = [];
    if (state.generic.has(name)) generics.push("P extends Params = Params");
    if (state.scoped.has(name)) generics.push("K extends string = string");
    const head = generics.length === 0 ? "" : `<${generics.join(", ")}>`;
    const scope: Scope = state.scoped.has(name)
      ? { key: "K", depth: 0 }
      : { depth: 0 };
    return `${jsdoc(node.doc, "")}export type ${typeName(name)}${head} = ${type(node, scope, state)};`;
  });

  const kindsHead = hasParams ? "<P extends Params = Params>" : "";
  const kinds = Object.entries(contract.kinds).map(
    ([kind, name]) =>
      `  ${prop(kind)}: ${typeName(name)}${state.generic.has(name) ? "<P>" : ""};`,
  );

  return [
    `// Generated by @schizomatic/kit from ${q(contract.id)}. Do not edit by hand.`,
    `import type { Artifact } from "@schizomatic/core";`,
    "",
    ...(hasParams
      ? [
          "/** The params that a service binds at boot. Narrow each member to its union. */",
          `export type Params = {\n${paramsType}\n};`,
          "",
        ]
      : []),
    ...defs.flatMap((def) => [def, ""]),
    "/** The type that each kind narrows to. */",
    `export type Kinds${kindsHead} = {\n${kinds.join("\n")}\n};`,
    "",
    `export declare const id: ${q(contract.id)};`,
    `export declare const kinds: readonly ${JSON.stringify(Object.keys(contract.kinds))};`,
    `export declare const params: readonly ${JSON.stringify(Object.keys(contract.params))};`,
    `export declare const handlers: readonly ${JSON.stringify(contract.handlers)};`,
    `export declare const make: Artifact["make"];`,
    "declare const artifact: Artifact;",
    "export default artifact;",
    "",
  ].join("\n");
};
