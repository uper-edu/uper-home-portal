import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkNotificationSettingsVersion,notificationGroupSettingsVersion,readNotificationSettingsReceipt,writeNotificationSettings} from '../server/portal/notificationSettingsOperations.ts';

const requestId='4b32b77e-63ca-49d8-80ec-453d805bef52';
const fixture=()=>{
  const entries=new Map<string,{fingerprint:string;result:object}>();
  const db={async query(sql:string,params:unknown[]=[]){
    const key=JSON.stringify(params.slice(0,2));
    if(sql.startsWith('INSERT'))entries.set(key,{fingerprint:String(params[2]),result:params[3] as object});
    const entry=entries.get(key);
    return {rows:entry?[entry]:[]};
  }};
  return {db,entries};
};

test('notification configuration writes have actor-scoped receipts and cannot repeat an accepted operation',async()=>{
  const {db,entries}=fixture();
  const body={requestId,expectedVersion:2,enabled:false};
  let saves=0;
  const write=async()=>{saves++;return {success:true};};
  await writeNotificationSettings(db,'manager','rule','rule-1',body,write);
  await writeNotificationSettings(db,'manager','rule','rule-1',body,write);
  assert.equal(saves,1);
  assert.deepEqual(await readNotificationSettingsReceipt(db,'manager',requestId),{success:true});
  await assert.rejects(readNotificationSettingsReceipt(db,'other-manager',requestId),{status:404});
  await assert.rejects(writeNotificationSettings(db,'manager','rule','rule-1',{...body,enabled:true},write),{status:409});
  await assert.rejects(writeNotificationSettings(db,'manager','group','rule-1',body,write),{status:409});
  assert.equal(saves,1);
  assert.equal(entries.size,1);
});

test('a stale version is rejected for a rule, existing group and new group ID',()=>{
  const old=notificationGroupSettingsVersion({mode:'simulation',maxPerHour:30});
  const changed=notificationGroupSettingsVersion({mode:'simulation',maxPerHour:60});
  checkNotificationSettingsVersion(old,old);
  checkNotificationSettingsVersion(null,null);
  assert.throws(()=>checkNotificationSettingsVersion(old,changed),{status:409});
  assert.throws(()=>checkNotificationSettingsVersion(null,changed),{status:409});
  assert.throws(()=>checkNotificationSettingsVersion(2,3),{status:409});
});
