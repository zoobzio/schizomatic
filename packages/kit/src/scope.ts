import type { Contract, Node, SetRef } from "@schizomatic/schema";

/**
 * Returns whether a set reference reads the enclosing key.
 */
const refScoped = (ref: SetRef | undefined): boolean => typeof ref === "object";

/**
 * Returns whether a node reads the enclosing key in its own scope. The
 * fields, the catchall, and the `valueBy` schemas of an object open a new
 * scope, so they do not count. The values of a record open a new scope too.
 * The items of an array stay in the scope of the array.
 *
 * @param node - The node to read.
 * @param def - Tells whether a def reads the enclosing key.
 */
export const scoped = (node: Node, def: (name: string) => boolean): boolean => {
  const next = (inner: Node): boolean => scoped(inner, def);
  switch (node.t) {
    case "member":
      return refScoped(node.param);
    case "array":
      return refScoped(node.exhaustive) || next(node.item);
    case "tuple":
      return (
        node.items.some(next) || (node.rest !== undefined && next(node.rest))
      );
    case "object":
      return (
        refScoped(node.keys?.subset) ||
        refScoped(node.keys?.superset) ||
        (node.names !== undefined && next(node.names))
      );
    case "record":
      return next(node.key);
    case "union":
      return node.options.some(next);
    case "discriminated":
      return Object.values(node.options).some(next);
    case "intersection":
      return node.parts.some(next);
    case "optional":
    case "nullable":
    case "default":
    case "custom":
      return next(node.inner);
    case "ref":
      return def(node.name);
    default:
      return false;
  }
};

/**
 * Returns whether a node reads a param anywhere in it, through refs too.
 */
export const generic = (
  node: Node,
  def: (name: string) => boolean,
): boolean => {
  const next = (inner: Node): boolean => generic(inner, def);
  switch (node.t) {
    case "member":
      return true;
    case "array":
      return node.exhaustive !== undefined || next(node.item);
    case "tuple":
      return (
        node.items.some(next) || (node.rest !== undefined && next(node.rest))
      );
    case "object":
      return (
        node.keys !== undefined ||
        Object.values(node.fields).some((field) => next(field.node)) ||
        (node.catchall !== undefined && next(node.catchall)) ||
        (node.names !== undefined && next(node.names)) ||
        (node.valueBy !== undefined &&
          Object.values(node.valueBy.schemas).some(next))
      );
    case "record":
      return next(node.key) || next(node.value);
    case "union":
      return node.options.some(next);
    case "discriminated":
      return Object.values(node.options).some(next);
    case "intersection":
      return node.parts.some(next);
    case "optional":
    case "nullable":
    case "default":
    case "custom":
      return next(node.inner);
    case "ref":
      return def(node.name);
    default:
      return false;
  }
};

/**
 * Settles a predicate over the defs of a contract. A def in a cycle counts
 * as `false` while the cycle is open. A second pass over the settled values
 * closes the cycles.
 *
 * @param contract - The contract.
 * @param read - The predicate over a node, given the predicate over defs.
 */
export const settle = (
  contract: Contract,
  read: (node: Node, def: (name: string) => boolean) => boolean,
): Set<string> => {
  const memo = new Map<string, boolean>();
  const visit = (name: string): boolean => {
    const known = memo.get(name);
    if (known !== undefined) {
      return known;
    }
    const node = contract.defs[name];
    if (node === undefined) {
      return false;
    }
    memo.set(name, false);
    const found = read(node, visit);
    memo.set(name, found);
    return found;
  };
  for (const name of Object.keys(contract.defs)) {
    visit(name);
  }
  const found = new Set<string>();
  for (const [name, node] of Object.entries(contract.defs)) {
    if (read(node, (ref) => memo.get(ref) ?? false)) {
      found.add(name);
    }
  }
  return found;
};
