import type {Response} from 'express';

/** Queue before taking a database connection, so Chat cannot fill the shared pool. */
export function chatAdmission(limit:number) {
  let active=0;
  const waiting=new Set<()=>void>();
  function release() {
    const next=waiting.values().next().value;
    if(next)next();
    else active--;
  }
  return (response:Pick<Response,'destroyed'|'once'|'off'>):Promise<(() => void)|undefined>=>{
    if(response.destroyed)return Promise.resolve(undefined);
    if(active<limit){
      active++;
      return Promise.resolve(release);
    }
    return new Promise(resolve=>{
      function admit(){
        waiting.delete(admit);
        response.off('close',cancel);
        resolve(release);
      }
      function cancel(){
        waiting.delete(admit);
        resolve(undefined);
      }
      waiting.add(admit);
      response.once('close',cancel);
    });
  };
}
