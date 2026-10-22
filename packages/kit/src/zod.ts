import type { Contract, Node, SetRef } from "@schizomatic/contract";

import { KitError } from "./error";
import { scoped as scopedNode, settle } from "./scope";

/**
 * The scope of an expression. `key` is a JavaScript expression that yields
 * the key of the nearest enclosing entry, when the expression is inside one.
 */
type Scope = { key?: string };

/**
 * The state of an emission. `order` holds the defs in dependency order.
 */
type State = {
  contract: Contract;
  order: { name: string; expr: string; scoped: boolean }[];
  done: Set<string>;
  visiting: Set<string>;
  scoped: Set<string>;
};

/**
 * The helpers at the top of the artifact. Each check reads the params at
 * `make` time. The checks add issues with the `custom` code of zod and name
 * the finer code in `params`.
 */
const PRELUDE = `
const $issue = (ctx, message, path, code) =>
  ctx.addIssue({ code: "custom", message, path, params: { code } });
const $forward = (ctx, key, result) => {
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({ ...issue, path: [key, ...issue.path] });
  }
};
const $subset = (set) =>
  z.superRefine((v, ctx) => {
    for (const k of Object.keys(v)) {
      if (!set.has(k)) $issue(ctx, \`Unknown key \${JSON.stringify(k)}.\`, [k], "unknown_key");
    }
  });
const $superset = (set) =>
  z.superRefine((v, ctx) => {
    for (const k of set) {
      if (!Object.hasOwn(v, k)) $issue(ctx, \`Missing key \${JSON.stringify(k)}.\`, [k], "missing_key");
    }
  });
const $names = (schema) =>
  z.superRefine((v, ctx) => {
    for (const k of Object.keys(v)) $forward(ctx, k, schema.safeParse(k));
  });
const $keyed = (factory) => {
  const cache = new Map();
  const of = (k) => {
    let found = cache.get(k);
    if (found === undefined) {
      found = factory(k);
      cache.set(k, found);
    }
    return found;
  };
  return z.superRefine((v, ctx) => {
    for (const k of Object.keys(v)) $forward(ctx, k, of(k).safeParse(v[k]));
  });
};
const $valueBy = (map, factories) => {
  const cache = new Map();
  return z.superRefine((v, ctx) => {
    for (const k of Object.keys(v)) {
      const factory = factories[map[k]];
      if (factory === undefined) continue;
      let schema = cache.get(k);
      if (schema === undefined) {
        schema = factory(k);
        cache.set(k, schema);
      }
      $forward(ctx, k, schema.safeParse(v[k]));
    }
  });
};
const $member = (set, slice, map, equals) =>
  z.superRefine((v, ctx) => {
    const name = slice === undefined ? v : v.slice(slice[0], slice[1]);
    if (!set.has(name)) {
      $issue(ctx, \`\${JSON.stringify(name)} is not a member.\`, [], "not_member");
      return;
    }
    if (map !== undefined && map[name] !== equals) {
      $issue(ctx, \`\${JSON.stringify(name)} is not of type \${JSON.stringify(equals)}.\`, [], "type_mismatch");
    }
  });
const $unique = z.superRefine((v, ctx) => {
  const seen = new Set();
  v.forEach((item, i) => {
    const k = JSON.stringify(item);
    if (seen.has(k)) $issue(ctx, "Duplicate item.", [i], "duplicate");
    seen.add(k);
  });
});
const $exhaustive = (set) =>
  z.superRefine((v, ctx) => {
    const have = new Set(v);
    for (const m of set) {
      if (!have.has(m)) $issue(ctx, \`Missing \${JSON.stringify(m)}.\`, [], "not_exhaustive");
    }
  });
const $handler = (fn) =>
  z.superRefine((v, ctx) => {
    const found = fn(v);
    if (found !== undefined) $issue(ctx, found.message, found.path ?? [], "custom");
  });
const $sets = new WeakMap();
const $setOf = (map, k) => {
  const list = map[k] ?? [];
  let found = $sets.get(list);
  if (found === undefined) {
    found = new Set(list);
    $sets.set(list, found);
  }
  return found;
};
`.trim();

const q = (s: string): string => JSON.stringify(s);

/**
 * Returns whether a node reads the enclosing key in its own scope.
 */
const scoped = (node: Node, state: State): boolean =>
  scopedNode(node, (name) => state.scoped.has(name));

/**
 * Returns whether a def reads the enclosing key.
 */
const defScoped = (name: string, state: State): boolean =>
  state.scoped.has(name);

/**
 * Emits the expression for a set reference.
 */
const setExpr = (ref: SetRef, scope: Scope, at: string): string => {
  if (typeof ref === "string") {
    return `S[${q(ref)}]`;
  }
  if (scope.key === undefined) {
    throw new KitError("the contract is invalid", [
      `${at}: the param ${q(ref.param)} is indexed by $key outside an entry`,
    ]);
  }
  return `$setOf(params[${q(ref.param)}], ${scope.key})`;
};

/**
 * Emits the list expression for a set reference, for `z.enum`.
 */
const listExpr = (ref: SetRef, scope: Scope, at: string): string => {
  if (typeof ref === "string") {
    return `params[${q(ref)}]`;
  }
  if (scope.key === undefined) {
    throw new KitError("the contract is invalid", [
      `${at}: the param ${q(ref.param)} is indexed by $key outside an entry`,
    ]);
  }
  return `(params[${q(ref.param)}][${scope.key}] ?? [])`;
};

/**
 * Emits the def with the name. The function emits the defs that the def
 * depends on first. A def in a cycle is referenced with `z.lazy`.
 */
const emitDef = (name: string, state: State): void => {
  if (state.done.has(name) || state.visiting.has(name)) {
    return;
  }
  const node = state.contract.defs[name];
  if (node === undefined) {
    throw new KitError("the contract is invalid", [
      `the def ${q(name)} does not exist`,
    ]);
  }
  state.visiting.add(name);
  const isScoped = defScoped(name, state);
  const found = expr(
    node,
    isScoped ? { key: "k" } : {},
    state,
    `#/$defs/${name}`,
  );
  state.visiting.delete(name);
  state.done.add(name);
  state.order.push({
    name,
    expr: isScoped ? `(k) => ${found}` : found,
    scoped: isScoped,
  });
};

/**
 * Emits the expression for a ref.
 */
const refExpr = (
  name: string,
  scope: Scope,
  state: State,
  at: string,
): string => {
  const isScoped = defScoped(name, state);
  let call = `D[${q(name)}]`;
  if (isScoped) {
    if (scope.key === undefined) {
      throw new KitError("the contract is invalid", [
        `${at}: the def ${q(name)} reads $key, but the ref is outside an entry`,
      ]);
    }
    call = `D[${q(name)}](${scope.key})`;
  }
  if (state.done.has(name)) {
    return call;
  }
  if (state.visiting.has(name)) {
    return `z.lazy(() => ${call})`;
  }
  emitDef(name, state);
  return call;
};

const withChecks = (base: string, checks: string[]): string =>
  checks.length === 0 ? base : `${base}.check(${checks.join(", ")})`;

/**
 * Emits the zod expression for a node.
 */
export const expr = (
  node: Node,
  scope: Scope,
  state: State,
  at: string,
): string => {
  switch (node.t) {
    case "string": {
      const base =
        node.format === "email"
          ? "z.email()"
          : node.format === "uuid"
            ? "z.uuid()"
            : node.format === "url"
              ? "z.url()"
              : node.format === "datetime"
                ? "z.iso.datetime()"
                : node.format === "date"
                  ? "z.iso.date()"
                  : "z.string()";
      const checks: string[] = [];
      if (node.min !== undefined) checks.push(`z.minLength(${node.min})`);
      if (node.max !== undefined) checks.push(`z.maxLength(${node.max})`);
      if (node.pattern !== undefined)
        checks.push(`z.regex(new RegExp(${q(node.pattern)}, "u"))`);
      return withChecks(base, checks);
    }
    case "number": {
      const checks: string[] = [];
      if (node.min !== undefined) checks.push(`z.gte(${node.min})`);
      if (node.max !== undefined) checks.push(`z.lte(${node.max})`);
      if (node.exclusiveMin !== undefined)
        checks.push(`z.gt(${node.exclusiveMin})`);
      if (node.exclusiveMax !== undefined)
        checks.push(`z.lt(${node.exclusiveMax})`);
      if (node.multipleOf !== undefined)
        checks.push(`z.multipleOf(${node.multipleOf})`);
      return withChecks(node.int ? "z.int()" : "z.number()", checks);
    }
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "unknown":
      return "z.unknown()";
    case "literal":
      return `z.literal(${JSON.stringify(node.value)})`;
    case "enum":
      if (node.values.every((value) => typeof value === "string")) {
        return `z.enum(${JSON.stringify(node.values)})`;
      }
      return `z.union([${node.values.map((value) => `z.literal(${JSON.stringify(value)})`).join(", ")}])`;
    case "array": {
      const checks: string[] = [];
      if (node.min !== undefined) checks.push(`z.minLength(${node.min})`);
      if (node.max !== undefined) checks.push(`z.maxLength(${node.max})`);
      if (node.unique) checks.push("$unique");
      if (node.exhaustive !== undefined)
        checks.push(`$exhaustive(${setExpr(node.exhaustive, scope, at)})`);
      return withChecks(
        `z.array(${expr(node.item, scope, state, `${at}/item`)})`,
        checks,
      );
    }
    case "tuple": {
      const items = node.items.map((item, index) =>
        expr(item, scope, state, `${at}/items/${index}`),
      );
      const rest =
        node.rest === undefined
          ? ""
          : `, ${expr(node.rest, scope, state, `${at}/rest`)}`;
      return `z.tuple([${items.join(", ")}]${rest})`;
    }
    case "object": {
      const fields = Object.entries(node.fields).map(([name, field]) => {
        const inner = expr(
          field.node,
          { key: q(name) },
          state,
          `${at}/fields/${name}`,
        );
        return `${q(name)}: ${field.optional ? `z.optional(${inner})` : inner}`;
      });
      const shape = fields.length === 0 ? "{}" : `{ ${fields.join(", ")} }`;
      let base =
        node.extra === "strict"
          ? `z.strictObject(${shape})`
          : node.extra === "passthrough"
            ? `z.looseObject(${shape})`
            : `z.object(${shape})`;
      const checks: string[] = [];
      if (node.catchall !== undefined) {
        if (scoped(node.catchall, state)) {
          checks.push(
            `$keyed((k) => ${expr(node.catchall, { key: "k" }, state, `${at}/catchall`)})`,
          );
        } else {
          base = `z.catchall(${base}, ${expr(node.catchall, {}, state, `${at}/catchall`)})`;
        }
      }
      if (node.names !== undefined) {
        checks.push(`$names(${expr(node.names, scope, state, `${at}/names`)})`);
      }
      if (node.keys?.subset !== undefined) {
        checks.push(`$subset(${setExpr(node.keys.subset, scope, at)})`);
      }
      if (node.keys?.superset !== undefined) {
        checks.push(`$superset(${setExpr(node.keys.superset, scope, at)})`);
      }
      if (node.valueBy !== undefined) {
        const factories = Object.entries(node.valueBy.schemas).map(
          ([value, schema]) =>
            `${q(value)}: (k) => ${expr(schema, { key: "k" }, state, `${at}/valueBy/${value}`)}`,
        );
        checks.push(
          `$valueBy(params[${q(node.valueBy.param)}], { ${factories.join(", ")} })`,
        );
      }
      return withChecks(base, checks);
    }
    case "record": {
      const key = expr(node.key, scope, state, `${at}/key`);
      if (scoped(node.value, state)) {
        return `z.looseObject({}).check($names(${key}), $keyed((k) => ${expr(node.value, { key: "k" }, state, `${at}/value`)}))`;
      }
      return `z.record(${key}, ${expr(node.value, {}, state, `${at}/value`)})`;
    }
    case "union":
      return `z.union([${node.options.map((option, index) => expr(option, scope, state, `${at}/options/${index}`)).join(", ")}])`;
    case "discriminated":
      return `z.discriminatedUnion(${q(node.tag)}, [${Object.entries(
        node.options,
      )
        .map(([value, option]) =>
          expr(option, scope, state, `${at}/options/${value}`),
        )
        .join(", ")}])`;
    case "intersection":
      return node.parts
        .map((part, index) => expr(part, scope, state, `${at}/parts/${index}`))
        .reduce((left, right) => `z.intersection(${left}, ${right})`);
    case "optional":
      return `z.optional(${expr(node.inner, scope, state, `${at}/inner`)})`;
    case "nullable":
      return `z.nullable(${expr(node.inner, scope, state, `${at}/inner`)})`;
    case "default":
      return `z._default(${expr(node.inner, scope, state, `${at}/inner`)}, () => ${JSON.stringify(node.value)})`;
    case "ref":
      return refExpr(node.name, scope, state, at);
    case "member": {
      if (node.slice === undefined && node.typed === undefined) {
        return `z.enum(${listExpr(node.param, scope, at)})`;
      }
      const slice =
        node.slice === undefined ? "undefined" : JSON.stringify(node.slice);
      const typed =
        node.typed === undefined
          ? "undefined, undefined"
          : `params[${q(node.typed.param)}], ${q(node.typed.equals)}`;
      return `z.string().check($member(${setExpr(node.param, scope, at)}, ${slice}, ${typed}))`;
    }
    case "custom":
      return `${expr(node.inner, scope, state, `${at}/inner`)}.check($handler(handlers[${q(node.id)}]))`;
  }
};

/**
 * Emits the zod source of an artifact. The source imports `zod/mini`. The
 * bundle step inlines it. `make` builds every def in dependency order and
 * returns one validator for each kind.
 *
 * A def that reads the enclosing key is a factory of the key. A ref to it
 * passes the key of the entry.
 *
 * @param contract - The contract to emit.
 */
export const zodSource = (contract: Contract): string => {
  const state: State = {
    contract,
    order: [],
    done: new Set(),
    visiting: new Set(),
    scoped: settle(contract, scopedNode),
  };
  for (const name of Object.keys(contract.defs)) {
    emitDef(name, state);
  }
  for (const [kind, name] of Object.entries(contract.kinds)) {
    if (defScoped(name, state)) {
      throw new KitError("the contract is invalid", [
        `the kind ${q(kind)} points to ${q(name)}, which reads $key and cannot be a kind`,
      ]);
    }
  }

  const sets = Object.entries(contract.params)
    .filter(([, param]) => param.kind === "set")
    .map(([name]) => `    ${q(name)}: new Set(params[${q(name)}]),`);
  const defs = state.order.map(
    ({ name, expr }) => `  D[${q(name)}] = ${expr};`,
  );
  const kinds = Object.entries(contract.kinds).map(
    ([kind, name]) => `    ${q(kind)}: D[${q(name)}],`,
  );

  return [
    `// Generated by @schizomatic/kit from ${q(contract.id)}. Do not edit by hand.`,
    `import * as z from "zod/mini";`,
    "",
    PRELUDE,
    "",
    `export const id = ${q(contract.id)};`,
    `export const kinds = Object.freeze(${JSON.stringify(Object.keys(contract.kinds))});`,
    `export const params = Object.freeze(${JSON.stringify(Object.keys(contract.params))});`,
    `export const handlers = Object.freeze(${JSON.stringify(contract.handlers)});`,
    "",
    "export const make = (params, handlers) => {",
    "  const S = {",
    ...sets,
    "  };",
    "  const D = {};",
    ...defs,
    "  return {",
    ...kinds,
    "  };",
    "};",
    "",
    "export default { id, kinds, params, handlers, make };",
    "",
  ].join("\n");
};
