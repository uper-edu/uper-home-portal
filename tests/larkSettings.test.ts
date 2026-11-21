import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {larkCallback,larkIdentityLocked,larkSettings,larkSettingsTarget,saveLarkSettings} from '../server/portal/larkSettings.ts';
import {larkApplication} from '../server/portal/integrationCredentialTargets.ts';
import {credentialSlot,makeCredentialVersion,type CredentialClient} from '../server/portal/integrationCredentials.ts';
import {exchangeLarkAuthorization,matchesLarkAuthorization} from '../server/portal/larkOAuth.ts';

const callback='http://localhost:3000/api/crm/lark/callback';
const appId='cli_fixture',tenant='tenant-fixture';

test('stored settings preserve the active key and bindings, and lock identity against concurrent edits',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'lark-settings-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'keyring.json');
  writeFileSync(file,JSON.stringify({environment:'dev',active:'test',keys:{test:randomBytes(32).toString('hex')}}),{mode:0o600});
  const values={PORTAL_ENV:'dev',PORTAL_PUBLIC_ORIGIN:'http://localhost:3000',PORTAL_CREDENTIAL_KEYRING_FILE:file,
    LARK_APP_ID:appId,LARK_TENANT_KEY:tenant,LARK_OAUTH_REDIRECT_URI:callback};
  const original=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  Object.assign(process.env,values);
  t.after(()=>{for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  const legacy={appId,tenant,callback,revision:0};
  const binding={employee:{appId,openId:'ou_fixture',revision:3}};
  let settings:typeof legacy|undefined;
  const slot=credentialSlot('lark-app','default');
  let credential={managed:true,revision:1,active:makeCredentialVersion(slot,larkSettingsTarget(legacy),{key:'mock-secret'})};
  const db:CredentialClient={async query(sql,params=[]){
    if(sql.startsWith('SELECT value FROM portal_settings')){assert.deepEqual(params,['lark_application:dev']);return {rows:settings?[{value:settings}]:[]};}
    if(sql.includes("FROM access_state WHERE id='lark_bindings'"))return {rows:[{value:binding}]};
    if(sql.startsWith('SELECT state FROM integration_credentials'))return {rows:[{state:credential}]};
    if(sql.startsWith('UPDATE integration_credentials'))credential=params[3];
    else if(sql.startsWith('INSERT INTO portal_settings'))settings=params[1];
    else assert.match(sql,/^INSERT INTO integration_credentials/);
    return {rows:[]};
  }};
  const expiryCase={...legacy,callback:'https://elsewhere.example/api/crm/lark/callback'};
  const credentialBefore=structuredClone(credential);
  assert.equal(await larkIdentityLocked(db),true);
  await assert.rejects(saveLarkSettings(db,{...legacy,appId:'cli_other'}),/identity_locked/);
  await assert.rejects(saveLarkSettings(db,{...legacy,tenant:'tenant-other'}),/identity_locked/);
  await assert.rejects(saveLarkSettings(db,expiryCase),/settings_invalid/);
  const stored=await saveLarkSettings(db,legacy);
  assert.deepEqual(stored,{...legacy,revision:1});
  assert.deepEqual(credential,credentialBefore);
  for(const name of ['LARK_APP_ID','LARK_TENANT_KEY','LARK_OAUTH_REDIRECT_URI'])delete process.env[name];
  assert.deepEqual(await larkSettings(db),stored);
  assert.equal((await larkApplication(db)).key,'mock-secret');
  assert.equal(binding.employee.appId,(await larkSettings(db)).appId);
  await assert.rejects(saveLarkSettings(db,legacy),/credential_conflict/);
  process.env.PORTAL_PUBLIC_ORIGIN='https://dev.example';
  const nextCallback='https://dev.example/api/crm/lark/callback';
  const changed=await saveLarkSettings(db,{...stored,callback:nextCallback});
  assert.equal(credential.active.target,larkSettingsTarget(changed));
  assert.equal((await larkApplication(db)).key,'mock-secret');
  assert.equal(binding.employee.revision,3);
  assert.equal(matchesLarkAuthorization({appId,tenant,redirect:callback},changed),false);
  assert.equal(matchesLarkAuthorization({appId,tenant,redirect:nextCallback},changed),true);
});

test('callback URL is limited to the current environment and exact route',()=>{
  const env={PORTAL_ENV:'dev',PORTAL_PUBLIC_ORIGIN:'http://localhost:3000'};
  assert.equal(larkCallback(callback,env)?.href,callback);
  for(const value of [callback+'?code=x',callback+'#return',callback+'/',callback.replace('3000','3001'),
    callback.replace('localhost','evil.example'),callback.replace('localhost','me@localhost')])
    assert.equal(larkCallback(value,env),undefined);
  assert.equal(larkCallback(callback,{...env,PORTAL_ENV:'test'}),undefined);
});

test('OAuth exchanges the saved app identity and rejects an unrelated tenant without exposing tokens',async()=>{
  for(const returnedTenant of [tenant,'other-tenant']){
    let calls=0;
    const request:typeof fetch=async(input,init)=>{
      const url=new URL(String(input));
      assert.equal(url.origin,'https://open.larksuite.com');
      calls++;
      if(calls===1){
        assert.deepEqual(JSON.parse(String(init?.body)),{app_id:appId,app_secret:'mock-key'});
        return Response.json({code:0,app_access_token:'mock-app-token'});
      }
      if(calls===2)return Response.json({code:0,data:{access_token:'mock-user-token'}});
      return Response.json({code:0,data:{open_id:'ou_fixture',name:'Fixture employee',tenant_key:returnedTenant}});
    };
    const exchange=exchangeLarkAuthorization({appId,tenant,redirect:callback},'mock-key','mock-code',request);
    if(returnedTenant===tenant)assert.deepEqual(await exchange,{openId:'ou_fixture',name:'Fixture employee'});
    else await assert.rejects(exchange,/lark_wrong_organization/);
    assert.equal(calls,3);
  }
});
