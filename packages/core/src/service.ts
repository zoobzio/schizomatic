import { z } from "zod";

import type {
  Artifact,
  Handler,
  Handlers,
  Options,
  Result,
  Validator,
} from "./types";

import { ArtifactError, SchemaError } from "./error";
import { verify } from "./verify";

/**
 * A node of the service tree: a validator, or the validators under one
 * directory of the source.
 */
type Tree = { [key: string]: Tree | Validator<unknown> };

/**
 * Encodes a defs name as a JSON Pointer segment, as RFC 6901 asks.
 */
const segment = (name: string): string =>
  name.replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * Calls a handler with the parsed value. The declaration of a built schema
 * types each handler by the schema it checks, so the value fits. TypeScript
 * cannot see that correlation across the map of handlers, so the one cast of
 * the service sits here.
 */
const call = (fn: Handler<never>, value: unknown) => fn(value as never);

/**
 * Attaches a handler to a zod schema as a refinement. Each problem becomes a
 * `custom` issue at the path of the problem.
 */
const refine = (schema: z.ZodType, fn: Handler<never>): z.ZodType =>
  schema.superRefine((value, ctx) => {
    const found = call(fn, value);
    if (found === undefined) {
      return;
    }
    for (const problem of Array.isArray(found) ? found : [found]) {
      ctx.addIssue({
        code: "custom",
        message: problem.message,
        path: problem.path ?? [],
      });
    }
  });

/**
 * Makes the four functions over a zod schema. Each function calls
 * `safeParse` once.
 */
const validator = (schema: z.ZodType): Validator<unknown> => {
  const inspect = (v: unknown): Result<unknown> => {
    const parsed = schema.safeParse(v);
    if (parsed.success) {
      return { success: true, data: parsed.data };
    }
    return { success: false, issues: parsed.error.issues };
  };
  const parse = (v: unknown): unknown => {
    const result = inspect(v);
    if (!result.success) {
      throw new SchemaError(result.issues);
    }
    return result.data;
  };
  return {
    check: (v: unknown): v is unknown => schema.safeParse(v).success,
    assert: (v: unknown): asserts v is unknown => {
      parse(v);
    },
    parse,
    inspect,
  };
};

/**
 * Makes the service over a built artifact. The function checks the options,
 * then builds one zod schema for each path of the artifact with
 * `z.fromJSONSchema` and places its validator in a tree that mirrors the
 * source directory. `audit/event` becomes `service.audit.event`.
 *
 * The declaration of a built schema types the artifact, so the service is
 * typed without a type argument. A hand-made artifact types itself through
 * `Artifact<S, H>`.
 *
 * @param artifact - The built artifact, the default export of `index.mjs`.
 * @param options - The handlers for the checks of the artifact.
 * @throws ArtifactError when a handler is missing, a document does not build,
 *   or two paths collide.
 */
export const makeService = <S, H extends Handlers>(
  artifact: Artifact<S, H>,
  options: Options<H> = {},
): S => {
  const problems = verify(artifact, options);
  if (problems.length > 0) {
    throw new ArtifactError(artifact.id, problems);
  }
  const handlers: Handlers = options.handlers ?? {};

  const root: Tree = {};
  const nodes = new Map<string, Tree>([["", root]]);

  /* Returns the node of a directory path, and makes it and its parents. */
  const directory = (path: string): Tree => {
    const found = nodes.get(path);
    if (found !== undefined) {
      return found;
    }
    const made: Tree = {};
    nodes.set(path, made);
    const cut = path.lastIndexOf("/");
    const parent = directory(cut === -1 ? "" : path.slice(0, cut));
    const name = path.slice(cut + 1);
    if (Object.hasOwn(parent, name)) {
      problems.push(`${path} is both a schema and a directory`);
    }
    parent[name] = made;
    return made;
  };

  for (const path of artifact.schemas) {
    let schema: z.ZodType;
    try {
      schema = z.fromJSONSchema({
        $ref: `#/$defs/${segment(path)}`,
        $defs: artifact.defs,
      });
    } catch (error) {
      problems.push(
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const check = artifact.checks[path];
    const fn = check === undefined ? undefined : handlers[check];
    if (fn !== undefined) {
      schema = refine(schema, fn);
    }
    const cut = path.lastIndexOf("/");
    const parent = directory(cut === -1 ? "" : path.slice(0, cut));
    const name = path.slice(cut + 1);
    if (Object.hasOwn(parent, name)) {
      problems.push(`${path} is both a schema and a directory`);
    }
    parent[name] = validator(schema);
  }

  if (problems.length > 0) {
    throw new ArtifactError(artifact.id, problems);
  }
  /* The tree mirrors the paths of the artifact. The declaration types the same paths. */
  return root as S;
};
