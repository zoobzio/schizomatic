/* Type proof for the access fixture. The build test compiles this file with tsc. */
import type {
  Bindings,
  Defaults,
  Kinds,
  Matrix,
  Mention,
  Policy,
} from "./.generated/index.mjs";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type P = {
  roles: "admin" | "viewer";
  resources: "doc" | "bucket";
  actions: { doc: "read" | "write"; bucket: "list" | "put" };
  owner: Record<string, string>;
};

export const mention: Equal<Mention<P>, "<admin>" | "<viewer>"> = true;
export const bindingKeys: Equal<keyof Bindings<P>, "admin" | "viewer"> = true;
export const defaults: Equal<
  Defaults<P>,
  { doc: "read" | "write"; bucket: "list" | "put" }
> = true;
export const matrixKeys: Equal<keyof Matrix<P>, "doc" | "bucket"> = true;
export const docActions: Equal<keyof Matrix<P>["doc"], "read" | "write"> = true;
export const bucketActions: Equal<keyof Matrix<P>["bucket"], "list" | "put"> =
  true;
export const priority: Equal<Policy<P>["priority"], ("doc" | "bucket")[]> =
  true;
export const kindsPolicy: Equal<Kinds<P>["policy"], Policy<P>> = true;
export const kindsRole: Equal<Kinds<P>["role"], "admin" | "viewer"> = true;
