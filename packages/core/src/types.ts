import type { z } from "zod";

/**
 * A JSON Schema document as the artifact holds it. A document is plain JSON.
 */
export type Document = { readonly [key: string]: unknown };

/**
 * A validation failure, as zod reports it. The service passes the issues of
 * zod through without change.
 */
export type Issue = z.core.$ZodIssue;

/**
 * One failure that a handler reports. `path` is relative to the value that
 * the handler received.
 */
export type Problem = { message: string; path?: PropertyKey[] };

/**
 * A named check over a schema. The service runs the handler after zod
 * accepts the value, so the handler receives the parsed output. The handler
 * returns nothing for a valid value, or one problem or a list of problems.
 */
export type Handler<V = unknown> = (v: V) => Problem | Problem[] | undefined;

/**
 * The handlers of an artifact, by name. The declaration of a built schema
 * types each handler by the schema it checks. A handler of any value fits a
 * map of handlers of no value, which is what the service holds.
 */
export type Handlers = { readonly [name: string]: Handler<never> };

/**
 * The outcome of an `inspect`. A success result holds the output narrowed to
 * the type of the schema. A failure result holds the issues.
 */
export type Result<V> =
  | { success: true; data: V }
  | { success: false; issues: Issue[] };

/**
 * The four functions over one schema. `check` is a type predicate. `assert`
 * throws a `SchemaError` with every issue. `parse` returns the output, with
 * the defaults filled. `inspect` returns a {@link Result}.
 */
export type Validator<V> = {
  check: (v: unknown) => v is V;
  assert: (v: unknown) => asserts v is V;
  parse: (v: unknown) => V;
  inspect: (v: unknown) => Result<V>;
};

/**
 * The built artifact. The kit writes it as `index.mjs`. `defs` holds every
 * schema and every def of the source by name. `schemas` lists the paths that
 * become validators, such as `audit/event`. `checks` names the handler of
 * each schema that has one.
 *
 * `S` is the type of the service: the validators by path. `H` is the type of
 * the handlers. The declaration of a built schema sets both. They are never
 * present at runtime.
 */
export type Artifact<S = unknown, H extends Handlers = Handlers> = {
  readonly id: string;
  readonly schemas: readonly string[];
  readonly checks: { readonly [path: string]: string };
  readonly defs: { readonly [name: string]: Document };
  readonly types?: { schema: S; handlers: H };
};

/**
 * The options of a service. `handlers` supplies a function for each check
 * of the artifact.
 */
export type Options<H extends Handlers = Handlers> = { handlers?: H };
