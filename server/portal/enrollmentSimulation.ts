import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';

export function approvedLocalEnrollmentSocketOrWindows(
  env: Record<string, string | undefined> = process.env,
  platform = process.platform,
): boolean {
  if (env.MYSQL_TRIAL_SOCKET === '/private/tmp/uper-crm-mysql-local3000.sock') return true;
  if (platform !== 'win32' || env.PORTAL_ENV !== 'dev' || env.APP_ENV !== 'local' ||
      env.PORTAL_DEPLOYMENT !== 'local-dev' || env.MYSQL_TRIAL_SOCKET) return false;
  try {
    const url = new URL(env.MYSQL_TRIAL_URL || '');
    return url.protocol === 'mysql:' && url.hostname === '127.0.0.1' &&
      (url.port || '3306') === '3306' && decodeURIComponent(url.pathname.slice(1)) === 'uper_local_crm';
  } catch {
    return false;
  }
}

export function isLocalEnrollmentRuntime(
  env: Record<string, string | undefined> = process.env,
  platform = process.platform,
) {
  return env.PORTAL_ENV === 'dev' && env.TRIAL_DATASET === 'local-crm' &&
    env.PORTAL_DEPLOYMENT !== 'remote-dev' && env.PORTAL_LOCAL_CUTOVER === 'true' &&
    approvedLocalEnrollmentSocketOrWindows(env, platform);
}

function isIsolatedTestMailbox(env: Record<string, string | undefined>) {
  if (env.PORTAL_ENV !== 'test' || env.PORTAL_DEPLOYMENT !== 'company-trial' ||
      env.TRIAL_DATASET !== 'synthetic') return false;
  const database = env.PORTAL_ENROLLMENT_SIMULATION_DATABASE;
  const url = URL.parse(env.MYSQL_TRIAL_URL ?? '');
  return Boolean(database && /^uper_trial_[a-z0-9_]+$/.test(database) &&
    url?.protocol === 'mysql:' && url.pathname === '/' + database);
}

export function enrollmentSimulation(
  env: Record<string, string | undefined> = process.env,
  platform = process.platform,
) {
  const directory = env.PORTAL_ENROLLMENT_SIMULATION_MAILBOX;
  if ((!isLocalEnrollmentRuntime(env, platform) && !isIsolatedTestMailbox(env)) ||
      !directory || !isAbsolute(directory)) return null;
  type Message={subject:string;html:string;text:string;language:string};
  async function deliver(id:string,email:string,message:Message,code?:string){
    await mkdir(directory, { mode: 0o700, recursive: true });
    const file=resolve(directory,id+'.json'),content=JSON.stringify({email,code,...message});
    try{await writeFile(file,content,{mode:0o600,flag:'wx'});}
    catch(error){
      if(code!==undefined||(error as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(file,'utf8')!==content)throw error;
    }
  }
  return {
    deliver:(id:string,email:string,code:string,message:Message)=>deliver(id,email,message,code),
    deliverMessage:(id:string,email:string,message:Message)=>deliver(id,email,message),
  };
}
