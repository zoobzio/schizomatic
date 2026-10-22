/**
 * The error that the kit throws when the config, a document, or the build is
 * not valid. The error lists every problem.
 */
export class KitError extends Error {
  readonly problems: string[];

  constructor(summary: string, problems: string[]) {
    const lines = problems.map((problem) => `  ${problem}`);
    super(`@schizomatic/kit: ${summary} —\n${lines.join("\n")}`);
    this.name = "KitError";
    this.problems = problems;
  }
}
