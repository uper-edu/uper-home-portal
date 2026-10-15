import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
import {backup,restore} from '../mysql/backup.mjs';
import {assertCompanyMaintenance} from '../mysql/company-maintenance.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
  if(!args.includes('--env'))throw Error('Explicit private maintenance environment required');
  const file=value('--env'),stat=await fs.lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.mode&0o077||(process.getuid&&stat.uid!==process.getuid()))throw Error('Owned private 0600 environment required');
  const env=dotenv.parse(await fs.readFile(file));
  if(env.PORTAL_DEPLOYMENT!=='company-trial')throw Error('Company trial only');
  assertCompanyMaintenance(env);
  if(args.includes('--backup'))console.log(await backup(env,value('--backup')));
  else if(args.includes('--restore')){
    if(!args.includes('--sha256')||!/^[a-f0-9]{64}$/.test(value('--sha256')))throw Error('Trusted backup checksum required');
    await restore(env,value('--restore'),value('--sha256'),{servicesStopped:args.includes('--services-stopped')});
    console.log({restored:true,reviewRequired:true,historicalNotificationsHeld:true});
  }else throw Error('Select --backup or --restore explicitly');
}
