import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrollmentMailPreset} from '../server/portal/enrollmentMailPresets.ts';
import {selectMailAccount} from '../server/portal/enrollmentMailRouting.ts';
import {activeEnrollmentMailConfig,enrollmentMailDefaults,enrollmentSmtpLimit,mailAccountDefaults,mailPoolDefaults} from '../src/utils/enrollmentMailConfig.ts';

const a={...mailAccountDefaults,address:'a@example.invalid',daily:20,external:2,monthly:30};
const b={...mailAccountDefaults,address:'b@example.invalid',daily:40,external:4,monthly:60};
const config={...enrollmentMailDefaults,accounts:[a,b]};
const eligible=new Set([a.address,b.address]);
test('the default limits distinguish message count and distinct external recipients',()=>{
  assert.equal(mailAccountDefaults.daily,450);
  assert.equal(mailAccountDefaults.external,200);
  assert.equal(mailAccountDefaults.monthly,null);
  assert.equal(mailAccountDefaults.rate,200);
  assert.equal(mailAccountDefaults.windowSeconds,100);
  assert.deepEqual(enrollmentSmtpLimit,{rate:200,windowSeconds:100});
});
test('chooses by normalized capacity, respecting monthly limits and fixed account affinity',()=>{
  const usage={
    [a.address]:{daily:10,external:0,monthly:30,seen:false},
    [b.address]:{daily:15,external:0,monthly:17,seen:false},
  };
  assert.equal(selectMailAccount(config,usage,eligible,{urgent:true,external:true})?.address,b.address);
  assert.equal(selectMailAccount(config,usage,eligible,{urgent:true,external:true,bound:a.address}),undefined);
});
test('a repeat recipient does not consume a new slot, and ordinary mail leaves headroom for codes',()=>{
  const usage={[a.address]:{daily:19,external:2,monthly:22,seen:true}};
  const fixed={bound:a.address,external:true};
  assert.equal(selectMailAccount(config,usage,eligible,{...fixed,urgent:true})?.address,a.address);
  assert.equal(selectMailAccount(config,usage,eligible,{...fixed,urgent:false}),undefined);
  usage[a.address].seen=false;
  assert.equal(selectMailAccount(config,usage,eligible,{...fixed,urgent:true}),undefined);
});
test('only selected pool accounts can send and removed fixed accounts cannot fall back automatically',()=>{
  const selected={...config,members:[b.address]};
  assert.equal(selectMailAccount(selected,{},eligible,{urgent:true,external:true})?.address,b.address);
  assert.equal(selectMailAccount(selected,{},eligible,{bound:a.address,urgent:true,external:true}),undefined);
  assert.equal(selectMailAccount({...config,members:[]},{},eligible,{urgent:true,external:true}),undefined);
});

test('priority uses pool member order, skips exhausted accounts, and honors a fixed sender',()=>{
  const selected=activeEnrollmentMailConfig({...config,selectedPool:'priority',pools:[{
    id:'priority',name:'Priority',enabled:true,transport:'smtp',members:[a.address,b.address],dailyLimit:null,strategy:'priority',
  }]});
  const opts={urgent:true,external:true};
  assert.equal(selectMailAccount(selected,{},eligible,opts)?.address,a.address);
  const usage={[a.address]:{daily:a.daily,monthly:0,external:0,seen:false}};
  assert.equal(selectMailAccount(selected,usage,eligible,opts)?.address,b.address);
  assert.equal(selectMailAccount(selected,usage,eligible,{...opts,bound:a.address}),undefined);
  assert.equal(selectMailAccount(selected,{},eligible,{...opts,bound:b.address})?.address,b.address);
});

test('production presets contain only credential references and are visible in other environments',()=>{
  const production=enrollmentMailPreset('prod');
  assert.equal(production.enabled,true);
  assert.equal(production.name,'Enrollment · Production');
  assert.deepEqual(production.pools?.map(pool=>pool.transport),['smtp','smtp','smtp']);
  assert.ok(production.pools!.every(pool=>pool.enabled&&pool.dailyLimit===null&&pool.strategy==='balanced'));
  assert.deepEqual([production.accounts[0].rate,production.accounts[0].windowSeconds],[200,100]);
  assert.deepEqual(production.members,['admission@uperedu.com','admissions@uperedu.com','registra@uperedu.com']);
  assert.deepEqual(production.accounts.slice(0,3).map(a=>a.secret),[
    'PORTAL_ENROLLMENT_SMTP_ADMISSION','PORTAL_ENROLLMENT_SMTP_ADMISSIONS','PORTAL_ENROLLMENT_SMTP_REGISTRA',
  ]);
  for(const a of production.accounts.slice(0,3))
    assert.deepEqual([a.host,a.port,a.daily,a.external,a.monthly],['smtp.larksuite.com',465,450,200,null]);
  for(const env of ['dev','test','unconfigured']){
    assert.deepEqual(enrollmentMailPreset(env).accounts,production.accounts);
    assert.ok(enrollmentMailPreset(env).members.every(address=>!production.members?.includes(address)));
  }
});

test('moves legacy pool settings to the selected Enrollment policy and to account limits',()=>{
  const preset=enrollmentMailPreset('dev');
  const accounts=preset.accounts.map(({rate:_,windowSeconds:__,...account})=>account);
  const pools=preset.pools!.map(pool=>pool.id==='local'?
    {...pool,sticky:false,rate:50,windowSeconds:120}:pool.id==='test'?
      {...pool,sticky:true,rate:70,windowSeconds:80,members:[...pool.members,...preset.members!]}:pool);
  const upgraded=enrollmentMailPreset('dev',{...preset,pools,accounts,sticky:true});
  assert.equal(upgraded.sticky,false);
  const local=upgraded.accounts.find(account=>account.address===preset.members![0])!;
  assert.deepEqual([local.rate,local.windowSeconds],[50,120]);
  assert.ok(upgraded.pools!.every(pool=>!('rate' in pool)&&!('sticky' in pool)));
  const switched=activeEnrollmentMailConfig({...upgraded,selectedPool:'test'});
  assert.equal(switched.sticky,false);
  assert.deepEqual(enrollmentMailPreset('dev',switched),switched);
});

test('renames the old built-in production label and preserves custom pool names',()=>{
  const config=enrollmentMailPreset('prod');
  for(const name of ['UPER Admissions · Production','UPER Admissions - Production','Admissions team']){
    const saved={...config,pools:config.pools?.map(pool=>pool.id==='production'?{...pool,name}:pool)};
    const updated=enrollmentMailPreset('prod',saved);
    assert.equal(updated.name,name==='Admissions team'?name:'Enrollment · Production');
    assert.deepEqual(updated.members,config.members);
    assert.equal(updated.selectedPool,config.selectedPool);
  }
});

test('legacy configuration preserves existing members and new presets keep separate choices',()=>{
  const legacy={...enrollmentMailDefaults,enabled:true,accounts:[a]};
  const config=enrollmentMailPreset('dev',legacy);
  assert.equal(config.selectedPool,'local');
  assert.deepEqual(config.members,[a.address,'hui.risker@gmail.com']);
  assert.equal(config.enabled,true);
  assert.equal(config.pools?.find(pool=>pool.id==='test')?.enabled,true);
  assert.equal(config.accounts.length,6);
  assert.equal(enrollmentMailPreset('test').selectedPool,'test');
});

test('each non-production pool seeds its own Gmail member and preserves saved disabled status',()=>{
  const local=enrollmentMailPreset('dev'), testEnv=enrollmentMailPreset('test');
  assert.deepEqual(local.members,['hui.risker@gmail.com']);
  assert.deepEqual(testEnv.members,['w20759@gmail.com']);
  for(const config of [local,testEnv]){
    assert.deepEqual(config.pools?.find(pool=>pool.id==='local')?.members,['hui.risker@gmail.com']);
    assert.deepEqual(config.pools?.find(pool=>pool.id==='test')?.members,['w20759@gmail.com']);
  }
  for(const [config,scope] of [[local,'dev'],[testEnv,'test']] as const){
    assert.equal(config.enabled,true);
    const account=config.accounts.find(a=>a.address===config.members?.[0])!;
    assert.deepEqual([account.host,account.port],['smtp.gmail.com',587]);
    const saved={...config,pools:config.pools?.map(pool=>({...pool,enabled:false,members:[]}))};
    const restored=enrollmentMailPreset(scope,saved);
    assert.deepEqual(restored.members,[]);
    assert.equal(restored.enabled,false);
  }
});

test('new pools start enabled with no daily limit and balanced routing',()=>{
  assert.deepEqual(mailPoolDefaults,{enabled:true,dailyLimit:null,strategy:'balanced'});
});

test('an explicit pool selection uses its configured members regardless of preset names or environment',()=>{
  const opts={urgent:true,external:true};
  for(const [env,poolId] of [['dev','production'],['test','local'],['prod','test']]){
    const preset=enrollmentMailPreset(env);
    const selected=enrollmentMailPreset(env,{...preset,selectedPool:poolId});
    const eligible=new Set(selected.accounts.map(account=>account.address));
    const pool=preset.pools?.find(pool=>pool.id===poolId);
    assert.equal(selected.selectedPool,poolId);
    assert.deepEqual(selected.members,pool?.members);
    assert.ok(pool?.members.includes(selectMailAccount(selected,{},eligible,opts)?.address??''));
    assert.equal(selectMailAccount(selected,{},new Set(),opts),undefined);
  }
});
