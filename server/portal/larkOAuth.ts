import type {LarkSettings} from './larkSettings.ts';

const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
type Identity={appId:string;tenant:string;redirect:string};

export function matchesLarkAuthorization(flow:Identity, settings:LarkSettings){
  return flow.appId===settings.appId&&flow.tenant===settings.tenant&&flow.redirect===settings.callback;
}

export async function exchangeLarkAuthorization(
  app:Identity, key:string, code:string, request:typeof fetch=fetch,
){
  const options={redirect:'error',signal:AbortSignal.timeout(10000)} as const;
  const post=async(path:string,body:object,token?:string)=>{
    const response=await request('https://open.larksuite.com'+path,{...options,method:'POST',
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok||result.code!==0)fail(502,'lark_authorization_failed');
    return result;
  };
  const auth=await post('/open-apis/auth/v3/app_access_token/internal',{app_id:app.appId,app_secret:key});
  if(!auth.app_access_token)fail(502,'lark_authorization_failed');
  const token=await post('/open-apis/authen/v1/access_token',{grant_type:'authorization_code',code},auth.app_access_token);
  if(!token.data?.access_token)fail(502,'lark_authorization_failed');
  const response=await request('https://open.larksuite.com/open-apis/authen/v1/user_info',
    {...options,headers:{Authorization:'Bearer '+token.data.access_token}});
  const info=await response.json();
  if(!response.ok||info.code!==0||!/^ou_[\w-]+$/.test(info.data?.open_id||''))fail(502,'lark_authorization_failed');
  if(info.data.tenant_key!==app.tenant)fail(403,'lark_wrong_organization');
  return {openId:info.data.open_id as string,name:String(info.data.name||'Lark').slice(0,191)};
}
