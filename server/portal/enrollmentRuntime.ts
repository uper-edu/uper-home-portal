import {enrollmentSimulation} from './enrollmentSimulation.ts';

export function enrollmentServicePolicy(
  env: Record<string, string | undefined> = process.env,
  platform = process.platform,
) {
  const simulation = Boolean(enrollmentSimulation(env, platform));
  const configuredService = env.PORTAL_ENROLLMENT_SERVICE_ENABLED === 'true' && (
    env.PORTAL_ENV === 'prod' && env.PORTAL_DEPLOYMENT === 'production' ||
    env.PORTAL_ENV === 'test' && env.PORTAL_DEPLOYMENT === 'company-trial'
  );
  const servicing = simulation || configuredService;
  const acceptingNew = servicing && (env.PORTAL_ENROLLMENT_ACCEPTING_NEW === 'true' ||
    simulation && env.PORTAL_ENROLLMENT_ACCEPTING_NEW === undefined);
  return {simulation, servicing, acceptingNew};
}
