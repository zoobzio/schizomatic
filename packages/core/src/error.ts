import type { Issue } from "./types";

/**
 * The error that `assert` and `parse` throw. The error holds every
 * {@link Issue} of the pass.
 */
export class SchemaError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    const lines = issues.map((issue) => {
      const at =
        issue.path.length > 0 ? ` at ${issue.path.map(String).join(".")}` : "";
      return `  ${issue.message}${at}`;
    });
    super(`schema validation failed —\n${lines.join("\n")}`);
    this.name = "SchemaError";
    this.issues = issues;
  }
}

/**
 * The error that `makeService` throws when the params or the handlers do not
 * match what the artifact declares. The error lists every problem.
 */
export class ArtifactError extends Error {
  readonly problems: string[];

  constructor(id: string, problems: string[]) {
    const lines = problems.map((problem) => `  ${problem}`);
    super(
      `@schizomatic/core: the options for ${JSON.stringify(id)} are invalid —\n${lines.join("\n")}`,
    );
    this.name = "ArtifactError";
    this.problems = problems;
  }
}
