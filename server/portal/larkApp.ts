/** Server-only Lark app transport. Never return provider bodies or credentials to callers. */
export class LarkApp {
  private cached?: {value:string;until:number};
  constructor(private env:NodeJS.ProcessEnv=process.env,private request:typeof fetch=(input,init)=>globalThis.fetch(input,init)){}
  get appId(){return this.env.LARK_APP_ID || '';}
  async token(){
    if(this.cached && this.cached.until>Date.now())return this.cached.value;
    if(!this.appId || !this.env.LARK_APP_SECRET)throw Error('lark_app_not_configured');
    const response=await this.request('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:this.appId,app_secret:this.env.LARK_APP_SECRET}),signal:AbortSignal.timeout(10000)});
    const body=await response.json();
    if(!response.ok || body.code!==0 || !body.tenant_access_token)throw Error('lark_app_auth_failed');
    this.cached={value:body.tenant_access_token,until:Date.now()+Math.max(0,Number(body.expire)-120)*1000};
    return this.cached.value;
  }
  async lookup(value:string,method:"email"|"mobile"="email"){
    const email=method==="email"?value.trim().toLowerCase():undefined;
    const mobile=method==="mobile"?value.trim():undefined;
    if(method==='email' && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))throw Error('lark_email_invalid');
    if(method==='mobile' && (!mobile || !/^\+[1-9]\d{6,14}$/.test(mobile)))throw Error('lark_mobile_invalid');
    const response=await this.request('https://open.larksuite.com/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await this.token()},body:JSON.stringify({...method==='email'?{emails:[email]}:{mobiles:[mobile]},include_resigned:false}),signal:AbortSignal.timeout(10000)});
    const body=await response.json();
    const users=body.data?.user_list;
    if(response.status===429 || body.code===99991400)throw Error('lark_rate_limited');
    if(body.code===99991672)throw Error('lark_directory_permission_missing');
    if(body.code===99991403)throw Error('lark_quota_exhausted');
    if(!response.ok||body.code!==0)throw Error('lark_directory_unavailable');
    if(!Array.isArray(users)||users.length!==1||!/^ou_[\w-]+$/.test(users[0].user_id))throw Error('lark_user_not_found');
    return {appId:this.appId,openId:users[0].user_id as string,...method==='email'?{email}:{mobile}};
  }
  async send(openId:string,card:any,uuid:string){
    if(this.env.LARK_PERSONAL_DELIVERY_ENABLED!=='true')throw Error('lark_personal_delivery_disabled');
    if(!/^ou_[\w-]+$/.test(openId))throw Error('lark_user_invalid');
    return this.request('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=open_id',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await this.token()},body:JSON.stringify({receive_id:openId,msg_type:card.msg_type,content:JSON.stringify(card.card||card.content),uuid}),signal:AbortSignal.timeout(10000)});
  }
}
export const larkApp=new LarkApp();
export type LarkBinding={appId:string;openId:string;email?:string;mobile?:string;revision:number;updatedAt:string};
export async function larkBindings(db:any){return (await db.query("SELECT value FROM access_state WHERE id='lark_bindings'")).rows[0]?.value || {};}

/** Only fixed diagnostic identifiers can reach the browser; never provider text. */
export function larkPublicError(value:unknown){
 const code=value instanceof Error?value.message:'';
 return ['lark_app_not_configured','lark_app_auth_failed','lark_email_invalid','lark_mobile_invalid','lark_identity_method_invalid','lark_rate_limited','lark_directory_permission_missing','lark_quota_exhausted','lark_directory_unavailable','lark_user_not_found'].includes(code)?code:'lark_connection_failed';
}

export function larkLookupInput(body:any):{value:string;method:'email'|'mobile'}{
 const method=body?.method||'email';
 if(!['email','mobile'].includes(method)|| (method==='email'&&body.mobile) || (method==='mobile'&&body.email))throw Error('lark_identity_method_invalid');
 const value=body?.[method];
 if(typeof value!=='string')throw Error(method==='mobile'?'lark_mobile_invalid':'lark_email_invalid');
 return {method,value};
}
