/* Type proof for the tokens fixture. The build test compiles this file with tsc. */
import type {
  Input,
  Kinds,
  Modifiers,
  Overrides,
  Reference,
  Theme,
} from "./.generated/index.mjs";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type P = {
  tokens: "primary" | "surface";
  modifiers: "color" | "motion";
  contexts: { color: "light" | "dark"; motion: "full" | "reduced" };
  types: Record<string, string>;
};

export const reference: Equal<Reference<P>, "{primary}" | "{surface}"> = true;
export const overridesKeys: Equal<keyof Overrides<P>, "primary" | "surface"> =
  true;
export const input: Equal<
  Input<P>,
  { color: "light" | "dark"; motion: "full" | "reduced" }
> = true;
export const modifierKeys: Equal<keyof Modifiers<P>, "color" | "motion"> = true;
export const colorContexts: Equal<
  keyof Modifiers<P>["color"],
  "light" | "dark"
> = true;
export const motionContexts: Equal<
  keyof Modifiers<P>["motion"],
  "full" | "reduced"
> = true;
export const themeOrder: Equal<Theme<P>["order"], ("color" | "motion")[]> =
  true;
export const kindsTheme: Equal<Kinds<P>["theme"], Theme<P>> = true;
export const kindsToken: Equal<Kinds<P>["token"], "primary" | "surface"> = true;
