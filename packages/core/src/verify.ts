import type { Artifact, Options } from "./types";

import { ArtifactError } from "./error";

/**
 * Checks the options against what the artifact declares. Each declared param
 * must be bound. Each declared handler must be supplied. A param or a handler
 * that the artifact does not declare is a problem too, as it is a sign of a
 * mismatch between the build and the service. The function throws an
 * {@link ArtifactError} with every problem.
 */
export const verify = (artifact: Artifact, options: Options): void => {
  const problems: string[] = [];
  const params = options.params ?? {};
  const handlers = options.handlers ?? {};

  for (const name of artifact.params) {
    if (!Object.hasOwn(params, name)) {
      problems.push(`params.${name} is required`);
    }
  }
  for (const name of Object.keys(params)) {
    if (!artifact.params.includes(name)) {
      problems.push(`params.${name} is not a param of the artifact`);
    }
  }
  for (const name of artifact.handlers) {
    if (typeof handlers[name] !== "function") {
      problems.push(`handlers.${name} is required`);
    }
  }
  for (const name of Object.keys(handlers)) {
    if (!artifact.handlers.includes(name)) {
      problems.push(`handlers.${name} is not a handler of the artifact`);
    }
  }

  if (problems.length > 0) {
    throw new ArtifactError(artifact.id, problems);
  }
};
