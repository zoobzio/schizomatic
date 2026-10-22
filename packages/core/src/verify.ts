import type { Artifact, Options } from "./types";

/**
 * Checks the options against the artifact. Each check of the artifact must
 * name a schema. Each handler that a check names must be supplied. A handler
 * that no check names is a problem too, as it is a sign of a mismatch between
 * the build and the service. The function returns every problem.
 *
 * @param artifact - The built artifact.
 * @param options - The options of the service.
 */
export const verify = (artifact: Artifact, options: Options): string[] => {
  const problems: string[] = [];
  const handlers = options.handlers ?? {};
  const schemas = new Set(artifact.schemas);
  const named = new Set<string>();

  for (const [path, name] of Object.entries(artifact.checks)) {
    named.add(name);
    if (!schemas.has(path)) {
      problems.push(`checks.${path} names no schema of the artifact`);
    }
  }
  for (const name of named) {
    if (typeof handlers[name] !== "function") {
      problems.push(`handlers.${name} is required`);
    }
  }
  for (const name of Object.keys(handlers)) {
    if (!named.has(name)) {
      problems.push(`handlers.${name} is not a check of the artifact`);
    }
  }
  return problems;
};
