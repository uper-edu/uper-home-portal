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
    async deliver(challengeId: string, email: string, code: string, message: {subject:string;html:string;text:string;language:string}) {
      await mkdir(directory, { mode: 0o700, recursive: true });
      await writeFile(resolve(directory, challengeId + '.json'), JSON.stringify({ email, code, ...message }),
        { mode: 0o600, flag: 'wx' });
    },
  };
}
