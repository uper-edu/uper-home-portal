import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';

export function enrollmentSimulation(env = process.env) {
  const directory = env.PORTAL_ENROLLMENT_SIMULATION_MAILBOX;
  if (env.PORTAL_ENV !== 'dev' || env.TRIAL_DATASET !== 'local-crm' ||
      env.PORTAL_DEPLOYMENT === 'remote-dev' || env.PORTAL_LOCAL_CUTOVER !== 'true' ||
      env.MYSQL_TRIAL_SOCKET !== '/private/tmp/uper-crm-mysql-local3000.sock' ||
      env.PORTAL_WORKER_ENABLED !== 'false' || env.PORTAL_GA_API_SECRET ||
      !directory || !isAbsolute(directory)) return null;
  return {
    bank: { name: 'TEST BANK', accountName: 'UPER TEST ONLY', accountNumber: 'TEST-0000000000' },
    async deliver(challengeId: string, email: string, code: string) {
      await mkdir(directory, { mode: 0o700, recursive: true });
      await writeFile(resolve(directory, challengeId + '.json'), JSON.stringify({ email, code }),
        { mode: 0o600, flag: 'wx' });
    },
  };
}
