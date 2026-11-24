import {enrollmentSimulation,isLocalEnrollmentRuntime} from './enrollmentSimulation.ts';
import {portalWorkerEnabled} from '../environment.mjs';

import type {EnrollmentMailMode} from '../../src/utils/enrollmentMailMode.ts';

// Runtime policy uses a mode supplied by the persisted configuration.
export function enrollmentServicePolicy(
  env: Record<string, string | undefined> = process.env,
  mode: EnrollmentMailMode = 'disabled',
  platform = process.platform,
) {
  const simulation = mode==='simulation' && Boolean(enrollmentSimulation(env, platform));
  const configuredService = env.PORTAL_ENROLLMENT_SERVICE_ENABLED === 'true' && (
    env.PORTAL_ENV === 'prod' && env.PORTAL_DEPLOYMENT === 'production' ||
    env.PORTAL_ENV === 'test' && env.PORTAL_DEPLOYMENT === 'company-trial'
  );
  const servicing = isLocalEnrollmentRuntime(env, platform) || configuredService;
  // Local OTP delivery does not process pre-existing orders or queued mail.
  const isolatedTestSimulation = env.PORTAL_ENV==='test' && !portalWorkerEnabled(env);
  const maintenance = !isolatedTestSimulation && (configuredService || simulation && env.PORTAL_ENROLLMENT_SERVICE_ENABLED === 'true');
  return {simulation, servicing, maintenance};
}
