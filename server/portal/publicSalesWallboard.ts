import {isCompanyTrial} from '../companyTrial.ts';

export const hasPublicSalesWallboard=(env=process.env)=>env.PORTAL_ENV==='test'&&isCompanyTrial(env);

export function shareWallboardSnapshot<T>(read:()=>Promise<T>,clock=Date.now){
  let cached:{value:T;until:number}|undefined;
  let pending:Promise<T>|undefined;
  return ()=>{
    if(cached&&clock()<cached.until)return Promise.resolve(cached.value);
    pending??=read().then(value=>{
      cached={value,until:clock()+60_000};
      return value;
    }).finally(()=>{pending=undefined;});
    return pending;
  };
}
