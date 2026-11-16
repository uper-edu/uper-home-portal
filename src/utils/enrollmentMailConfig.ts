export type MailAccount={
  address:string;host:string;port:465|587;secret:string;enabled:boolean;
  daily:number;external:number;monthly:number|null;rate:number;windowSeconds:number;
};
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
  address:'',host:'smtp.larksuite.com',port:465,secret:'',enabled:true,daily:450,external:200,monthly:null,...enrollmentSmtpLimit,
};

export const mailPoolMembers=(config:{members?:string[];accounts:Pick<MailAccount,'address'>[]})=>
  config.members??config.accounts.map(account=>account.address);

export type MailPoolStrategy='balanced'|'priority';
export type MailPool=Pick<EnrollmentMailConfig,'name'|'enabled'> & {
  id:string;members:string[];transport:'smtp';dailyLimit:number|null;strategy:MailPoolStrategy;
};
export const mailPoolDefaults:Pick<MailPool,'enabled'|'dailyLimit'|'strategy'>={enabled:true,dailyLimit:null,strategy:'balanced'};
export const mailPoolDailyLimitMax=100000;
export const mailSmtpHostPattern='[a-zA-Z0-9](?:[a-zA-Z0-9.\\-]{0,251}[a-zA-Z0-9])?';
export const mailSecretReferencePattern='PORTAL_ENROLLMENT_SMTP_[A-Z0-9_]{1,64}';

export function activeEnrollmentMailConfig(config:EnrollmentMailConfig):EnrollmentMailConfig{
  const pool=config.pools?.find(pool=>pool.id===config.selectedPool);
  return pool?{...config,name:pool.name,enabled:pool.enabled,members:pool.members,transport:pool.transport}:config;
}
