import { z } from "zod";

import type { Artifact, Handler, Params } from "../src";

/**
 * A stand-in for a built artifact. The kit writes the real one as `index.mjs`
 * with zod bundled in. This one builds the same shape with the zod of the
 * test. It has a set param, a map param, and a named handler, as the untheme
 * token contract needs.
 */
export const artifact: Artifact = {
  id: "demo",
  kinds: ["user", "token", "overrides", "order"],
  params: ["tokens", "types"],
  handlers: ["acyclic"],
  make: (params: Params, handlers: Record<string, Handler>) => {
    const tokens = params.tokens as string[];
    const types = params.types as Record<string, string>;
    const acyclic = handlers.acyclic as Handler;

    const user = z.object({
      id: z.uuid(),
      email: z.email(),
      role: z.enum(["admin", "member"]),
      tags: z.array(z.string()).max(3).default([]),
    });

    const token = z.enum(tokens);

    const color = z.object({ hex: z.string().regex(/^#[0-9a-f]{6}$/) });
    const dimension = z.object({
      value: z.number(),
      unit: z.enum(["px", "rem"]),
    });
    const byType: Record<string, z.ZodType> = { color, dimension };

    const overrides = z
      .partialRecord(token, z.unknown())
      .superRefine((value, ctx) => {
        for (const [name, bound] of Object.entries(value)) {
          const shape = byType[types[name] ?? ""];
          if (shape === undefined) {
            continue;
          }
          const parsed = shape.safeParse(bound);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              ctx.addIssue({ ...issue, path: [name, ...issue.path] });
            }
          }
        }
        const found = acyclic(value);
        if (found !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: found.message,
            path: found.path ?? [],
          });
        }
      });

    const order = z
      .array(token)
      .refine((list) => new Set(list).size === list.length, {
        message: "Order has a duplicate.",
      })
      .refine((list) => tokens.every((name) => list.includes(name)), {
        message: "Order must list every token.",
      });

    return { user, token, overrides, order };
  },
};

/** The params for the demo artifact. */
export const params: Params = {
  tokens: ["primary", "surface", "space"],
  types: { primary: "color", surface: "color", space: "dimension" },
};

/** A handler that rejects an override map where any value names `{cycle}`. */
export const acyclic: Handler = (v) => {
  const map = v as Record<string, unknown>;
  for (const [name, bound] of Object.entries(map)) {
    if (bound === "{cycle}") {
      return { message: "Overrides form a cycle.", path: [name] };
    }
  }
  return undefined;
};

/** The options that bind the demo artifact. */
export const options = { params, handlers: { acyclic } };

/** The kinds of the demo artifact, as the kit would declare them. */
export type Kinds = {
  user: { id: string; email: string; role: "admin" | "member"; tags: string[] };
  token: "primary" | "surface" | "space";
  overrides: Partial<Record<"primary" | "surface" | "space", unknown>>;
  order: ("primary" | "surface" | "space")[];
};
