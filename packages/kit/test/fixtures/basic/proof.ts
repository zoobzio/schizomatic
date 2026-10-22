/* Type proof for the basic fixture. The build test compiles this file with tsc. */
import type { Kinds, Page, Tree, User } from "./.generated/index.mjs";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export const userRole: Equal<User["role"], "admin" | "member"> = true;
export const userTags: Equal<User["tags"], string[]> = true;
export const userAge: Equal<User["age"], number | null | undefined> = true;
export const pageSpan: Equal<Page["span"], [number, number] | undefined> = true;
export const treeChildren: Equal<Tree["children"], Tree[]> = true;
export const kindsUser: Equal<Kinds["user"], User> = true;
export const eventKinds: Equal<Kinds["event"]["kind"], "created" | "deleted"> =
  true;
