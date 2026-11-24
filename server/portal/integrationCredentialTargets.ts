import nodemailer from 'nodemailer';
import {mailSmtpEndpoint} from '../../src/utils/enrollmentMailConfig.ts';
import {credentialTarget, integrationCredential, type CredentialClient, type CredentialValues} from './integrationCredentials.ts';
import {resolveGroupWebhook, validWebhook} from './larkGroupWebhook.ts';
import {cmsMediaConfiguration} from '../../cloud/mysql/cms-media-storage.mjs';
import {larkSettings,larkSettingsTarget,type LarkSettings} from './larkSettings.ts';

export const aiCredentialUrl = (provider: string, env = process.env) => provider === 'deepseek'
  ? env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/chat/completions'
  : env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/chat/completions';
export const aiCredentialTarget = (provider: string) => credentialTarget([provider, aiCredentialUrl(provider)]);
export const legacyAiCredential = (provider: string, env = process.env) => {
  const key = provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.OPENAI_API_KEY;
  return key ? {key} : undefined;
};

export const smtpCredentialTarget = (account: {address:string;host:string;port:number}) =>
  credentialTarget([account.address, account.host.toLowerCase(), String(account.port)]);
export function smtpTransportOptions(account:{address:string;host:string;port:number}){
  const endpoint=mailSmtpEndpoint(account);
  if(!endpoint)return;
  return {host:endpoint.host,port:endpoint.port,secure:endpoint.encryption==='TLS',
    requireTLS:endpoint.encryption==='STARTTLS',tls:{servername:endpoint.host,rejectUnauthorized:true,minVersion:'TLSv1.2' as const}};
}

type GroupConfig = {groupName?:string;team?:string;signingEnabled?:boolean;signingSecretRef?:string;encryptedWebhook?:string;secretRef?:string};
export const groupCredentialTarget = (config: GroupConfig) =>
  credentialTarget([config.team || '', config.groupName || '', String(config.signingEnabled ?? !!config.signingSecretRef)]);
export function legacyGroupCredential(id: string, config: GroupConfig, env = process.env) {
  const webhook = resolveGroupWebhook(id, config, env);
  if (!webhook) return;
  const signingKey = config.signingSecretRef && (config.signingEnabled ?? true) ? env[config.signingSecretRef] : undefined;
  return signingKey ? {webhook, signingKey} : {webhook};
}
export function groupCredential(id: string, config: GroupConfig, db?: CredentialClient) {
  return integrationCredential('lark-group', id, groupCredentialTarget(config), () => legacyGroupCredential(id, config), db);
}

export const larkAppCredentialTarget = (env = process.env) =>
  credentialTarget([env.LARK_APP_ID || '', env.LARK_TENANT_KEY || '', env.LARK_OAUTH_REDIRECT_URI || '']);
export const legacyLarkAppCredential = (env = process.env) => env.LARK_APP_SECRET ? {key: env.LARK_APP_SECRET} : undefined;
export async function larkAppCredential(db?:CredentialClient, settings?:LarkSettings){
  return integrationCredential('lark-app','default',larkSettingsTarget(settings??await larkSettings(db)),legacyLarkAppCredential,db);
}
export async function larkApplication(db?:CredentialClient){
  if(!db&&process.env.MYSQL_TRIAL_URL&&process.env.PORTAL_ENV){
    const {tx}=await import('./store.ts');
    return tx((client:CredentialClient)=>larkApplication(client)) as Promise<LarkSettings&{key:string|undefined}>;
  }
  const settings=await larkSettings(db);
  const key=(await larkAppCredential(db,settings))?.key;
  return {...settings,key};
}

export const legacyGaCredential = (env = process.env) => env.PORTAL_GA_API_SECRET?.trim() ? {key: env.PORTAL_GA_API_SECRET.trim()} : undefined;

export const cosCredentialTarget = (env = process.env) => {
  const {bucket, region, prefix} = cmsMediaConfiguration(env);
  return credentialTarget([bucket, region, prefix]);
};
export const legacyCosCredential = (env = process.env): CredentialValues|undefined =>
  env.PORTAL_COS_SECRET_ID && env.PORTAL_COS_SECRET_KEY
    ? {secretId: env.PORTAL_COS_SECRET_ID, secretKey: env.PORTAL_COS_SECRET_KEY,
      ...(env.PORTAL_COS_SECURITY_TOKEN ? {token: env.PORTAL_COS_SECURITY_TOKEN} : {})} : undefined;

export type SmtpVerificationFailure =
  | {kind:'smtp_auth_rejected';replyCode:number}
  | {kind:'smtp_connection'|'smtp_tls'|'smtp_timeout'|'smtp_unsupported_target'|'smtp_unknown'};

export function smtpVerificationFailure(error:unknown):SmtpVerificationFailure {
  const {code,command,responseCode,library,message}=(error??{}) as {
    code?:string;command?:string;responseCode?:number;library?:string;message?:string;
  };
  if(code==='ETIMEDOUT'||code==='ETIMEOUT')return {kind:'smtp_timeout'};
  if((code==='EAUTH'||command?.startsWith('AUTH '))&&typeof responseCode==='number'&&
    Number.isInteger(responseCode)&&responseCode>=400&&responseCode<=599)
    return {kind:'smtp_auth_rejected',replyCode:responseCode};
  // Nodemailer wraps some Node certificate errors as ESOCKET. Inspect locally, and return only a category.
  if(code==='ETLS'||command==='STARTTLS'||code?.startsWith('ERR_TLS_')||code?.startsWith('ERR_SSL_')||
    library==='SSL routines'||code==='ESOCKET'&&/certificate|self[- ]signed|unable to verify|ssl routines/i.test(message??''))
    return {kind:'smtp_tls'};
  if(['ESOCKET','ECONNECTION','EDNS','ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH'].includes(code??''))
    return {kind:'smtp_connection'};
  return {kind:'smtp_unknown'};
}

export async function verifySmtpCredential(account: {address:string;host:string;port:number}, password: string):Promise<true|SmtpVerificationFailure> {
  const options=smtpTransportOptions(account);
  if(!options)return {kind:'smtp_unsupported_target'};
  const transport = nodemailer.createTransport({
    ...options,
    auth: {user: account.address, pass: password}, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    logger:false,debug:false,
  });
  try {
    return await transport.verify()?true:{kind:'smtp_unknown'};
  } catch(error) {
    return smtpVerificationFailure(error);
  } finally { transport.close(); }
}

export function validGroupCredential(values: CredentialValues, signing: boolean) {
  return validWebhook(values.webhook) && (signing ? !!values.signingKey : !values.signingKey);
}
