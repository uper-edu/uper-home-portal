/** Allow a read to recover once, regardless of whether reconnection arrives before or after failure. */
export function watchReadReconnect(retry:()=>void,{foregroundOnly=false}={}) {
  let state:'reading'|'reconnected'|'waiting'|'ready'|'stopped'='reading';
  const stop=()=>{
    state='stopped';
    window.removeEventListener('online',onOnline);
    if(foregroundOnly)document.removeEventListener('visibilitychange',onVisible);
  };
  const recover=()=>{
    if(foregroundOnly&&document.hidden){
      state='ready';
      return false;
    }
    stop();
    retry();
    return true;
  };
  const onOnline=()=>{
    if(state==='waiting'||state==='ready')recover();
    else state='reconnected';
  };
  const onVisible=()=>{
    if(state==='ready'&&!document.hidden&&navigator.onLine!==false)recover();
  };
  window.addEventListener('online',onOnline);
  if(foregroundOnly)document.addEventListener('visibilitychange',onVisible);
  return {
    failed() {
      if(state==='stopped'||state==='ready')return false;
      if(state==='reconnected')return recover();
      state='waiting';
      return false;
    },
    stop,
  };
}
