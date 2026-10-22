/* Type proof for the access fixture. The build test compiles this file with tsc. */
import type { Handler, Validator } from "@schizomatic/core";

import type {
  Bindings,
  Handlers,
  Mention,
  PolicyFull,
  PolicyPartial,
  Priority,
  Role,
  Roster,
  Schema,
} from "./.generated/index.mjs";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export const role: Equal<Role, "admin" | "viewer" | "bot"> = true;
export const mention: Equal<Mention, "<admin>" | "<viewer>" | "<bot>"> = true;
export const rosterKeys: Equal<keyof Roster, "admin" | "viewer" | "bot"> = true;
export const bindingsBot: Equal<
  Bindings["bot"],
  Mention | { key: string; ttl: "1h" | "1d" } | undefined
> = true;
export const priority: Equal<Priority, Role[]> = true;
export const fullRoster: Equal<PolicyFull["roster"], Roster> = true;
export const fullMatrix: Equal<
  PolicyFull["matrix"],
  { [key: string]: Bindings }
> = true;
export const partialRoster: Equal<
  PolicyPartial["roster"],
  Bindings | undefined
> = true;
export const schemaPartial: Equal<
  Schema["policy"]["partial"],
  Validator<PolicyPartial>
> = true;
export const handler: Equal<Handlers["noSelfGrant"], Handler<Bindings>> = true;
