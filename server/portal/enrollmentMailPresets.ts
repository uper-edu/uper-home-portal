import {activeEnrollmentMailConfig,enrollmentMailDefaults,mailAccountDefaults,mailPoolDefaults,mailPoolMembers,type EnrollmentMailConfig,type MailAccount,type MailPool} from '../../src/utils/enrollmentMailConfig.ts';

type SavedPool=Omit<MailPool,'dailyLimit'|'strategy'> & Partial<Pick<MailPool,'dailyLimit'|'strategy'>> & {sticky?:boolean;rate?:number;windowSeconds?:number};
type SavedMailConfig=Omit<EnrollmentMailConfig,'accounts'|'pools'> & {
  accounts:(Omit<MailAccount,'rate'|'windowSeconds'> & Partial<Pick<MailAccount,'rate'|'windowSeconds'>>)[];
  pools?:SavedPool[];rate?:number;windowSeconds?:number;
};

const officialAccounts=[
  {address:'admission@uperedu.com',secret:'PORTAL_ENROLLMENT_SMTP_ADMISSION'},
  {address:'admissions@uperedu.com',secret:'PORTAL_ENROLLMENT_SMTP_ADMISSIONS'},
  {address:'registra@uperedu.com',secret:'PORTAL_ENROLLMENT_SMTP_REGISTRA'},
];

const developmentAccounts={
  dev:{pool:'local',address:'hui.risker@gmail.com',secret:'PORTAL_ENROLLMENT_SMTP_LOCAL_GMAIL'},
  test:{pool:'test',address:'w20759@gmail.com',secret:'PORTAL_ENROLLMENT_SMTP_TEST_GMAIL'},
} as const;
const productionPoolName='Enrollment · Production';

export function enrollmentMailPreset(environment:string,saved?:SavedMailConfig):EnrollmentMailConfig{
  const poolDefaults={...mailPoolDefaults,transport:'smtp' as const};
  const development=Object.values(developmentAccounts);
  const presets:MailPool[]=[
    {id:'production',...poolDefaults,name:productionPoolName,members:officialAccounts.map(a=>a.address)},
    {id:'local',...poolDefaults,name:'Enrollment · Local',members:[developmentAccounts.dev.address]},
    {id:'test',...poolDefaults,name:'Enrollment · Test',members:[developmentAccounts.test.address]},
  ];
  const defaultId=environment==='prod'?'production':environment==='test'?'test':'local';
  const existingPools:SavedPool[]=saved?.pools??(saved?[{
    id:defaultId,transport:'smtp' as const,name:saved.name,enabled:saved.enabled,sticky:saved.sticky,rate:saved.rate,
    windowSeconds:saved.windowSeconds,members:mailPoolMembers(saved),
  }]:[]);
  const missingDevelopment=development.filter(preset=>!saved?.accounts.some(account=>account.address===preset.address));
  const pools=[...existingPools.map(pool=>({id:pool.id,enabled:pool.enabled,transport:'smtp' as const,
    dailyLimit:pool.dailyLimit??mailPoolDefaults.dailyLimit,strategy:pool.strategy??mailPoolDefaults.strategy,
    name:pool.id==='production'&&['UPER Admissions · Production','UPER Admissions - Production'].includes(pool.name)?productionPoolName:pool.name,
    members:[...new Set([
    ...pool.members,...missingDevelopment.filter(preset=>preset.pool===pool.id).map(preset=>preset.address),
  ])]})),...presets.filter(pool=>!existingPools.some(existing=>existing.id===pool.id))];
  const accounts=[...saved?.accounts.map(account=>{
    const inherited=existingPools.filter(pool=>pool.members.includes(account.address)&&pool.rate!==undefined&&pool.windowSeconds!==undefined);
    return {...account,
      rate:account.rate??(inherited.length?Math.min(...inherited.map(pool=>pool.rate!)):mailAccountDefaults.rate),
      windowSeconds:account.windowSeconds??(inherited.length?Math.max(...inherited.map(pool=>pool.windowSeconds!)):mailAccountDefaults.windowSeconds)};
  })??[],...officialAccounts.filter(a=>!saved?.accounts.some(existing=>existing.address===a.address))
    .map(account=>({...mailAccountDefaults,...account})),
    ...missingDevelopment.map(({address,secret})=>({...mailAccountDefaults,address,secret,host:'smtp.gmail.com',port:587 as const}))];
  const selectedPool=pools.some(p=>p.id===saved?.selectedPool)?saved!.selectedPool!:defaultId;
  const sticky=existingPools.find(pool=>pool.id===selectedPool)?.sticky??saved?.sticky??enrollmentMailDefaults.sticky;
  return activeEnrollmentMailConfig({...enrollmentMailDefaults,sticky,accounts,pools,selectedPool});
}
