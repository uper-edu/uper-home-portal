import test from 'node:test';
import assert from 'node:assert/strict';
import {gaSettings, saveGaSettings} from '../server/portal/gaSettings.ts';

test('GA settings persist per environment and reject wrong targets, stale writes and enablement without credentials', async () => {
  const previous=process.env;
  process.env={...previous,PORTAL_ENV:'dev',PORTAL_GA_MEASUREMENT_ID:'G-RTB5CWXVWV'};
  delete process.env.PORTAL_GA_DISPATCH_ENABLED;
  delete process.env.PORTAL_GA_API_SECRET;
  const records=new Map<string,unknown>();
  const db={async query(sql:string,params:any[]=[]){
    if(sql.startsWith('INSERT INTO portal_settings'))records.set(params[0],params[1]);
    return {rows:sql.startsWith('SELECT value FROM portal_settings')&&records.has(params[0])?[{value:records.get(params[0])}]:[]};
  }};
  try{
    const initial=await gaSettings(db);
    assert.equal(initial.dispatchEnabled,false);
    await assert.rejects(saveGaSettings(db,{...initial,measurementId:'G-SZCY9WLK8X'}),/credential_ga_settings_invalid/);
    await assert.rejects(saveGaSettings(db,{...initial,dispatchEnabled:true}),/credential_ga_key_required/);
    const saved=await saveGaSettings(db,initial);
    assert.deepEqual(await gaSettings(db),{...initial,revision:1});
    await assert.rejects(saveGaSettings(db,initial),/credential_conflict/);
    process.env.PORTAL_ENV='test';
    assert.equal((await gaSettings(db)).revision,0);
    process.env.PORTAL_ENV='dev';
    assert.deepEqual(await gaSettings(db),saved);
  }finally{process.env=previous;}
});
