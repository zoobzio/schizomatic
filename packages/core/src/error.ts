import type { Issue } from "./types";

/**
 * The error that `assert` and `parse` throw. The error holds every
 * {@link Issue} of the pass.
 */
export class SchemaError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    const lines = issues.map((issue) => {
      const at = issue.path?.length ? ` at ${issue.path.join(".")}` : "";
      return `  ${issue.message}${at}`;
    });
    super(`schema validation failed —\n${lines.join("\n")}`);
    this.name = "SchemaError";
    this.issues = issues;
  }
}
