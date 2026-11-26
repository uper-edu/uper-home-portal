import configuration from "../src/data/analyticsEnvironments.json" with { type: "json" };

/** Public destination metadata only. Runtime credentials are never part of this object. */
export function analyticsBuildConfiguration(target) {
  if (!Object.hasOwn(configuration.environments, target)) throw Error("Unknown analytics build target");
  const expected = configuration.environments[target];
  if (!/^G-[A-Z0-9]+$/.test(expected.measurementId??"")) throw Error("Invalid GA measurement ID for " + target);
  return { target, ...expected };
}
