import configuration from "../src/data/analyticsEnvironments.json" with { type: "json" };

/** Public destination metadata only. Runtime credentials are never part of this object. */
export function analyticsBuildConfiguration(target, publicEnvironment) {
  const expected = configuration.environments[target];
  if (!expected) throw Error("Unknown analytics build target");
  const id = publicEnvironment.VITE_UPER_MEASUREMENT_ID;
  if (!id)
    throw Error(
      "Missing VITE_UPER_MEASUREMENT_ID for " +
        target +
        "; use its assigned GA stream",
    );
  if (id !== expected.measurementId)
    throw Error(
      "GA measurement ID does not match the assigned " + target + " stream",
    );
  return { target, ...expected };
}
