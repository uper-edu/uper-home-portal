import {mailPoolMembers,type EnrollmentMailConfig,type MailAccount,type MailPool} from '../../src/utils/enrollmentMailConfig.ts';

export type Usage={daily:number;external:number;monthly:number;recipients:number;seen:boolean};
export function mailPoolQuotaReason(pool:Pick<MailPool,'dailyLimit'|'dailyRecipientLimit'>,
  usage:{total:number;recipients:number;seen:boolean}) {
  if(pool.dailyLimit!==null&&usage.total>=pool.dailyLimit)return 'pool_daily_limit';
  if(pool.dailyRecipientLimit!==null&&!usage.seen&&usage.recipients>=pool.dailyRecipientLimit)
    return 'pool_daily_recipient_limit';
}
export function selectMailAccount(config:EnrollmentMailConfig, usage:Record<string,Usage>, eligible:Set<string>,
    {bound,urgent,external}: {bound?:string;urgent:boolean;external:boolean}) {
  const empty:Usage={daily:0,external:0,monthly:0,recipients:0,seen:false};
  const usedBy=(account:MailAccount)=>usage[account.address]??empty;
  // Keep five percent available for codes without making low test limits unusable.
  const usable=(limit:number)=>urgent?limit:limit-Math.min(limit-1,Math.ceil(limit*.05));
  const withinQuota=(account:MailAccount)=>{
    const used=usedBy(account);
    return used.daily<usable(account.daily)&&(!external||used.seen||used.external<usable(account.external))&&
      (account.monthly===null||used.monthly<usable(account.monthly));
  };
  const strategy=config.pools?.find(pool=>pool.id===config.selectedPool)?.strategy??'balanced';
  const messages=(account:MailAccount)=>(usedBy(account).daily+1)/usable(account.daily);
  const score=(account:MailAccount)=>{
    const used=usedBy(account);
    if(strategy==='message_count')return messages(account);
    if(strategy==='recipient_count')return used.recipients+Number(!used.seen);
    return Math.max(messages(account),external&&!used.seen?(used.external+1)/usable(account.external):0,
      account.monthly===null?0:(used.monthly+1)/usable(account.monthly));
  };
  const members=new Map(mailPoolMembers(config).map((address,index)=>[address,index]));
  const candidates=config.accounts.filter(account=>members.has(account.address)&&account.enabled&&eligible.has(account.address)&&
    (!bound||account.address===bound)&&withinQuota(account));
  if(strategy==='priority')
    return candidates.sort((a,b)=>members.get(a.address)!-members.get(b.address)!)[0];
  return candidates.sort((a,b)=>score(a)-score(b)||
    (strategy==='recipient_count'?Number(usedBy(b).seen)-Number(usedBy(a).seen)||messages(a)-messages(b):0)||
    usedBy(a).daily-usedBy(b).daily||a.address.localeCompare(b.address))[0];
}
