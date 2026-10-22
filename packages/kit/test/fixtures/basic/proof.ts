/* Type proof for the basic fixture. The build test compiles this file with tsc. */
import type { Handler, Validator } from "@schizomatic/core";

import type {
  AuditLog,
  Created,
  Event,
  Handlers,
  Page,
  Schema,
  Tree,
  User,
} from "./.generated/index.mjs";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export const userRole: Equal<User["role"], "admin" | "member"> = true;
export const userTags: Equal<User["tags"], string[]> = true;
export const userAge: Equal<User["age"], number | null | undefined> = true;
export const pageSpan: Equal<Page["span"], [number, number] | undefined> = true;
export const pageMeta: Equal<
  Page["meta"],
  { [key: string]: number } | undefined
> = true;
export const pageBoth: Equal<
  Page["both"],
  ({ a: string } & { b: number }) | undefined
> = true;
export const eventKinds: Equal<Event["kind"], "created" | "deleted"> = true;
export const createdUser: Equal<Created["user"], User> = true;
export const treeChildren: Equal<Tree["children"], Tree[]> = true;
export const logActor: Equal<AuditLog["actor"], User> = true;
export const schemaUser: Equal<Schema["user"], Validator<User>> = true;
export const schemaLog: Equal<
  Schema["audit"]["log"],
  Validator<AuditLog>
> = true;
export const handlerSorted: Equal<Handlers["sorted"], Handler<AuditLog>> = true;
