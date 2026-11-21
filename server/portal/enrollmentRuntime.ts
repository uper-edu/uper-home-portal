import {enrollmentSimulation,isLocalEnrollmentRuntime} from './enrollmentSimulation.ts';

import type {EnrollmentMailMode} from '../../src/utils/enrollmentMailMode.ts';

// Runtime policy uses a mode supplied by the persisted configuration.
export function enrollmentServicePolicy(env = process.env, mode:EnrollmentMailMode = 'disabled') {
  const simulation = mode==='simulation' && Boolean(enrollmentSimulation(env));
  const configuredService = env.PORTAL_ENROLLMENT_SERVICE_ENABLED === 'true' && (
    env.PORTAL_ENV === 'prod' && env.PORTAL_DEPLOYMENT === 'production' ||
    env.PORTAL_ENV === 'test' && env.PORTAL_DEPLOYMENT === 'company-trial'
  );
  const servicing = isLocalEnrollmentRuntime(env) || configuredService;
  // Local OTP delivery does not process pre-existing orders or queued mail.
  const isolatedTestSimulation = env.PORTAL_ENV==='test' && env.PORTAL_WORKER_ENABLED==='false';
  const maintenance = !isolatedTestSimulation && (configuredService || simulation && env.PORTAL_ENROLLMENT_SERVICE_ENABLED === 'true');
  return {simulation, servicing, maintenance};
}
