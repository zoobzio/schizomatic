import type { Contract } from "schizomatic";

/**
 * A fixture for a kind. `valid` values pass. `invalid` values fail.
 */
export type Fixture = {
  kind: string;
  valid: unknown[];
  invalid: unknown[];
};

/**
 * A contract with its fixtures. The proof runs the fixtures through the
 * compiled rules and through the oracle.
 */
export type Case = {
  contract: Contract;
  fixtures: Fixture[];
};
