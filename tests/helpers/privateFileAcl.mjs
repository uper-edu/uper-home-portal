// Apply only to the caller's synthetic temporary test file. chmod on Windows does not edit its DACL.
import {execFileSync} from 'node:child_process';
import {chmodSync} from 'node:fs';
import {join} from 'node:path';

export function grantFixtureReadToOthers(file){
  if(process.platform==='win32'){
    execFileSync(join(process.env.SystemRoot,'System32','icacls.exe'),[file,'/grant','*S-1-5-11:(R)'],{stdio:'pipe',windowsHide:true});
  }else chmodSync(file,0o644);
}
