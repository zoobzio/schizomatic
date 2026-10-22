import { z } from "zod";

import type { Artifact, Handler, Params } from "../src";

/**
 * A stand-in for a built artifact. The kit writes the real one as `index.mjs`
 * with zod bundled in. This one builds the same shape with the zod of the
 * test. It has a set param, a map param, and a named handler.
 */
export const artifact: Artifact = {
  id: "demo",
  kinds: ["user", "role", "bindings", "priority"],
  params: ["roles", "owner"],
  handlers: ["noSelfGrant"],
  make: (params: Params, handlers: Record<string, Handler>) => {
    const roles = params.roles as string[];
    const owner = params.owner as Record<string, string>;
    const noSelfGrant = handlers.noSelfGrant as Handler;

    const user = z.object({
      id: z.uuid(),
      email: z.email(),
      role: z.enum(["admin", "member"]),
      tags: z.array(z.string()).max(3).default([]),
    });

    const role = z.enum(roles);

    const person = z.object({ email: z.email() });
    const service = z.object({ key: z.string(), ttl: z.enum(["1h", "1d"]) });
    const byOwner: Record<string, z.ZodType> = { person, service };

    const bindings = z
      .partialRecord(role, z.unknown())
      .superRefine((value, ctx) => {
        for (const [name, grant] of Object.entries(value)) {
          const shape = byOwner[owner[name] ?? ""];
          if (shape === undefined) {
            continue;
          }
          const parsed = shape.safeParse(grant);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              ctx.addIssue({ ...issue, path: [name, ...issue.path] });
            }
          }
        }
        const found = noSelfGrant(value);
        if (found !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: found.message,
            path: found.path ?? [],
          });
        }
      });

    const priority = z
      .array(role)
      .refine((list) => new Set(list).size === list.length, {
        message: "Priority has a duplicate.",
      })
      .refine((list) => roles.every((name) => list.includes(name)), {
        message: "Priority must list every role.",
      });

    return { user, role, bindings, priority };
  },
};

/** The params for the demo artifact. */
export const params: Params = {
  roles: ["admin", "viewer", "bot"],
  owner: { admin: "person", viewer: "person", bot: "service" },
};

/** A handler that rejects a binding where a role grants itself. */
export const noSelfGrant: Handler = (v) => {
  const map = v as Record<string, unknown>;
  for (const [name, grant] of Object.entries(map)) {
    if (grant === `<${name}>`) {
      return { message: "A role grants itself.", path: [name] };
    }
  }
  return undefined;
};

/** The options that bind the demo artifact. */
export const options = { params, handlers: { noSelfGrant } };

/** The kinds of the demo artifact, as the kit would declare them. */
export type Kinds = {
  user: { id: string; email: string; role: "admin" | "member"; tags: string[] };
  role: "admin" | "viewer" | "bot";
  bindings: Partial<Record<"admin" | "viewer" | "bot", unknown>>;
  priority: ("admin" | "viewer" | "bot")[];
};
