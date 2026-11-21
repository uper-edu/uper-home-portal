export type MailAccount={
  address:string;host:string;port:465|587;secret:string;enabled:boolean;
  daily:number;external:number;monthly:number|null;rate:number;windowSeconds:number;
};
export const mailSmtpProviders={
  lark:{host:'smtp.larksuite.com',port:465},
  gmail:{host:'smtp.gmail.com',port:587},
} as const;
export type MailSmtpProvider=keyof typeof mailSmtpProviders;

export function mailSmtpProvider(host:string):MailSmtpProvider|undefined{
  const normalized=host.toLowerCase();
  if(normalized===mailSmtpProviders.lark.host)return 'lark';
  if(normalized===mailSmtpProviders.gmail.host)return 'gmail';
}

export function mailSmtpEndpoint(account:{host:string;port:number}){
  const provider=mailSmtpProvider(account.host);
  if(!provider||(account.port!==465&&account.port!==587))return;
  return {host:mailSmtpProviders[provider].host,port:account.port,
    encryption:account.port===465?'TLS':'STARTTLS'};
}

export type EnrollmentMailConfig={
  name:string;enabled:boolean;sticky:boolean;
  accounts:MailAccount[];transport?:'smtp';members?:string[];pools?:MailPool[];selectedPool?:string;
};
export const enrollmentMailDefaults:EnrollmentMailConfig={
  name:'Enrollment',enabled:false,sticky:true,accounts:[],transport:'smtp',
};
export const enrollmentMailPoolLimit=20;
export const enrollmentSmtpLimit={rate:200,windowSeconds:100};
export const mailAccountDefaults:MailAccount={
  address:'',...mailSmtpProviders.lark,secret:'',enabled:true,daily:450,external:200,monthly:null,...enrollmentSmtpLimit,
};

export const mailPoolMembers=(config:{members?:string[];accounts:Pick<MailAccount,'address'>[]})=>
  config.members??config.accounts.map(account=>account.address);

export const mailPoolStrategies=['balanced','message_count','recipient_count','priority'] as const;
export type MailPoolStrategy=typeof mailPoolStrategies[number];
export const isMailPoolStrategy=(value:unknown):value is MailPoolStrategy=>mailPoolStrategies.some(strategy=>strategy===value);
export type MailPool=Pick<EnrollmentMailConfig,'name'|'enabled'> & {
  id:string;members:string[];transport:'smtp';dailyLimit:number|null;dailyRecipientLimit:number|null;strategy:MailPoolStrategy;
};
export const mailPoolDefaults:Pick<MailPool,'enabled'|'dailyLimit'|'dailyRecipientLimit'|'strategy'>={enabled:true,dailyLimit:null,dailyRecipientLimit:null,strategy:'balanced'};
export const mailPoolDailyLimitMax=100000;
export const mailSmtpHostPattern='[a-zA-Z0-9](?:[a-zA-Z0-9.\\-]{0,251}[a-zA-Z0-9])?';
export const mailSecretReferencePattern='PORTAL_ENROLLMENT_SMTP_[A-Z0-9_]{1,64}';

export function activeEnrollmentMailConfig(config:EnrollmentMailConfig):EnrollmentMailConfig{
  const pool=config.pools?.find(pool=>pool.id===config.selectedPool);
  return pool?{...config,name:pool.name,enabled:pool.enabled,members:pool.members,transport:pool.transport}:config;
}
