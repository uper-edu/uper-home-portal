import {mailPoolMembers,type EnrollmentMailConfig,type MailAccount} from '../../src/utils/enrollmentMailConfig.ts';

export type Usage={daily:number;external:number;monthly:number;seen:boolean};
export function selectMailAccount(config:EnrollmentMailConfig, usage:Record<string,Usage>, eligible:Set<string>,
    {bound,urgent,external}: {bound?:string;urgent:boolean;external:boolean}) {
  const empty:Usage={daily:0,external:0,monthly:0,seen:false};
  // Keep five percent available for codes without making low test limits unusable.
  const usable=(limit:number)=>urgent?limit:limit-Math.min(limit-1,Math.ceil(limit*.05));
  const score=(account:MailAccount)=>{
    const used=usage[account.address]??empty;
    const addsRecipient=external&&!used.seen;
    if(used.daily>=usable(account.daily)||addsRecipient&&used.external>=usable(account.external)||
       account.monthly!==null&&used.monthly>=usable(account.monthly))return Infinity;
    return Math.max((used.daily+1)/usable(account.daily),
      addsRecipient?(used.external+1)/usable(account.external):0,
      account.monthly===null?0:(used.monthly+1)/usable(account.monthly));
  };
  const members=new Map(mailPoolMembers(config).map((address,index)=>[address,index]));
  const candidates=config.accounts.filter(account=>members.has(account.address)&&account.enabled&&eligible.has(account.address)&&
    (!bound||account.address===bound)&&Number.isFinite(score(account)));
  if(config.pools?.find(pool=>pool.id===config.selectedPool)?.strategy==='priority')
    return candidates.sort((a,b)=>members.get(a.address)!-members.get(b.address)!)[0];
  return candidates
    .sort((a,b)=>score(a)-score(b)||(usage[a.address]?.daily??0)-(usage[b.address]?.daily??0)||a.address.localeCompare(b.address))[0];
}
