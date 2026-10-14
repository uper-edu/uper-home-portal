import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

function client(){
  const cookies=new Map(),base='http://127.0.0.1:4412';
  return async(path,body,method=body===undefined?'GET':'POST',origin=base)=>{
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(';')},body:body===undefined?undefined:JSON.stringify(body)});
    for(const header of response.headers.getSetCookie()){const [name,value]=header.split(';')[0].split('=');cookies.set(name,value);}
    return {status:response.status,json:await response.json()};
  };
}
test('MySQL six-account access matrix, claim races, server-side scopes and visitor isolation',{skip:!process.env.MYSQL_PERMISSIONS_TEST},async()=>{
  const anon=client(),visitor=client(),intruder=client(),accounts={};
  for(const name of ['Suki','Robert','Fadhil','Zainul','Wigar','Tester']){
    const call=accounts[name]=client();
    const login=await call('/api/crm/auth/login',{loginId:name,password:name});assert.equal(login.status,200);
    const leader=['Suki','Robert','Tester'].includes(name);
    assert.equal(login.json.employee.scope,leader?'all':'own');
    assert.equal((await call('/api/crm/notification-rules')).status,leader?200:403);
    assert.equal((await call('/api/crm/export')).status,leader?200:403);
    if(!leader){
      assert.equal((await call('/api/crm/notification-channels/TEST_forbidden',{mode:'simulation',groupName:'TEST forbidden'})).status,403);
      assert.equal((await call('/api/crm/campaigns',{name:'TEST forbidden'})).status,403);
    }
  }
  assert.equal((await anon('/api/crm/leads')).status,401);
  assert.equal((await anon('/api/crm/auth/me')).status,401);
  assert.equal((await anon('/api/crm/auth/login',{loginId:'Robert',password:'invalid'})).status,401);
  assert.equal((await anon('/api/crm/auth/login',{loginId:'Robert',password:'Robert'},'POST','https://untrusted.example')).status,403);
  const conversation=await visitor('/api/portal/conversations',{source:'standalone_chat'});
  const registration=await visitor('/api/portal/register',{fullName:'TEST Permissions '+randomUUID(),email:randomUUID()+'@example.invalid',whatsapp:'0000009981',goal:'Work in China',reportedLevel:'Beginner',city:'Jakarta',mode:'Online'});
  assert.equal(registration.status,200);const id=registration.json.lead.id;
  for(const name of ['Fadhil','Zainul','Wigar'])assert.equal((await accounts[name]('/api/crm/leads/'+id)).status,200);
  assert.equal((await accounts.Fadhil('/api/crm/leads/'+id,{currentStage:'Contacted'},'PATCH')).status,404);
  const claims=await Promise.all(['Fadhil','Zainul','Wigar'].map(name=>accounts[name]('/api/crm/leads/'+id+'/claim',{})));
  assert.equal(claims.filter(r=>r.status===200).length,1);
  const owner=(await accounts.Robert('/api/crm/leads/'+id)).json.lead.owner;
  assert.equal((await accounts[owner]('/api/crm/leads/'+id,{owner:owner==='Wigar'?'Fadhil':'Wigar'},'PATCH')).status,403);
  for(const name of ['Suki','Robert','Tester'])assert.equal((await accounts[name]('/api/crm/leads/'+id)).status,200);
  for(const name of ['Fadhil','Zainul','Wigar'].filter(n=>n!==owner)){
    assert.equal((await accounts[name]('/api/crm/leads/'+id)).status,404);
    assert.equal((await accounts[name]('/api/crm/leads?ownership=all&workScope=all')).json.leads.some(l=>l.id===id),false);
    assert.equal((await accounts[name]('/api/crm/leads/'+id+'/logs',{requestId:randomUUID(),connectStatus:'Connected',summary:'TEST forbidden',channel:'WhatsApp',disposition:'keep'})).status,404);
  }
  assert.equal((await intruder('/api/chat',{conversationId:conversation.json.conversationId,messageId:randomUUID(),content:'TEST unauthorized'})).status,404);
  assert.equal((await intruder('/api/portal/actions',{conversationId:conversation.json.conversationId,messageId:randomUUID(),action:'handoff',content:'TEST unauthorized'})).status,404);
  assert.equal((await accounts.Robert('/api/crm/leads/'+id,{owner:'Suki'},'PATCH')).status,400);
  assert.equal((await accounts.Robert('/api/crm/leads/'+id,{owner:'Tester'},'PATCH')).status,200);
  assert.equal((await accounts.Tester('/api/crm/leads/'+id)).status,200);
  assert.equal((await accounts.Tester('/api/crm/auth/logout',{})).status,200);
  assert.equal((await accounts.Tester('/api/crm/leads')).status,401);
});
