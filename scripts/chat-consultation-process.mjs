import {spawnSync} from 'node:child_process';
import {isAbsolute} from 'node:path';

// Windows cannot execute a Node shebang directly. Keep arguments separate; never use a shell.
export function runTool(program,args,options){
  return isAbsolute(program) && /\.[cm]?js$/i.test(program)
    ? spawnSync(process.execPath,[program,...args],options)
    : spawnSync(program,args,options);
}
