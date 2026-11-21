import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';

export function isLocalEnrollmentRuntime(env = process.env) {
  return env.PORTAL_ENV === 'dev' && env.TRIAL_DATASET === 'local-crm' &&
    env.PORTAL_DEPLOYMENT !== 'remote-dev' && env.PORTAL_LOCAL_CUTOVER === 'true' &&
    env.MYSQL_TRIAL_SOCKET === '/private/tmp/uper-crm-mysql-local3000.sock';
}

export function enrollmentSimulation(env = process.env) {
  const directory = env.PORTAL_ENROLLMENT_SIMULATION_MAILBOX;
  const transport = env.PORTAL_ENROLLMENT_MAIL_TRANSPORT;
  if (!isLocalEnrollmentRuntime(env) || (transport && transport !== 'simulation') ||
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
