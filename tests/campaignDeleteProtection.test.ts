import test from 'node:test';
import assert from 'node:assert/strict';
if (!process.env.MYSQL_NATIVE_TEST_ENV) test('campaign deletion checks Lead attribution before removing all short links and indexes', async t => {
  const mockEnv = {
    TRIAL_DATASET:'synthetic',
    PORTAL_DEPLOYMENT:'local',
    PORTAL_ENV:'dev',
    MYSQL_TRIAL_URL:'mysql://test:placeholder@localhost/uper_trial_campaign_delete_mock',
    MYSQL_TRIAL_SOCKET:'/dev/null/unused-mysql.sock',
  };
  for (const [key, value] of Object.entries(mockEnv)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const {deleteCampaign} = await import('../server/portal/mysqlCampaignStorage.ts');
  const {operationContext} = await import('../server/portal/operationContext.ts');
  const campaign = {id:'custom', code:'campaign-code', name:'Custom', promotionLinks:[{id:'first'}, {id:'second'}]};
  const writes: Array<[string, string[]]> = [];
  const run = (profiles: object[] = [], linkedPromotion = '', reviewedCampaign = false) => operationContext.run({
    async query(sql: string, params: string[]) {
      if (sql.startsWith('SELECT code,config')) return {rows:[{code:campaign.code, config:campaign}]};
      if (sql === 'SELECT profile FROM portal_leads') return {rows:profiles.map(profile => ({profile}))};
      if (sql.startsWith('SELECT id FROM portal_leads')) return {rows:params[0] === linkedPromotion ? [{id:'lead'}] : []};
      if (sql.startsWith('SELECT id FROM campaign_source_reviews')) return {rows:reviewedCampaign ? [{id:'review'}] : []};
      if (sql.startsWith('SELECT id FROM portal_audit')) return {rows:[]};
      assert.match(sql, /^DELETE /);
      writes.push([sql.split(' ')[2], params]);
      return {rowCount:1};
    },
  }, () => deleteCampaign(campaign.id));

  const conflict = {status:409, message:'This campaign has customer attribution and cannot be deleted.'};
  await assert.rejects(run([{campaignId:campaign.code}]), conflict);
  await assert.rejects(run([{identitySources:[{campaignId:campaign.id}]}]), conflict);
  await assert.rejects(run([], 'second'), conflict);
  await assert.rejects(run([], '', true), {status:409});
  assert.deepEqual(writes, []);
  assert.equal(await run(), true);
  assert.deepEqual(writes, [
    ['campaign_promotion_short_links', ['first']],
    ['campaign_promotion_index', ['first', 'custom']],
    ['campaign_promotion_short_links', ['second']],
    ['campaign_promotion_index', ['second', 'custom']],
    ['trial_campaigns', ['custom']],
  ]);
});

if (!process.env.MYSQL_NATIVE_TEST_ENV) {
  test('campaign deletion protection requires isolated MySQL', {skip:'Set MYSQL_NATIVE_TEST_ENV'},()=>{});
} else {
  const {setupNativeTest}=await import('./helpers/mysql.mjs');
  await setupNativeTest('delete691');
  Object.assign(process.env,{PLATFORM_MODE:'local',PORT:'4592',PORTAL_WORKER_ENABLED:'false'});
  const {pool}=await import('../server/portal/store.ts');
  const seeds=[['TEST691-home','home'],['TEST691-case',' HOME '],['TEST691-normal','test691-normal'],['TEST691-links','test691-links'],['TEST691-review','test691-review']];
  for(const [id,code] of seeds)await pool.query('INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)',[id,code,{id,code,name:id,stats:{impressions:0,budgetCost:0},...(id.endsWith('-links')?{promotionLinks:[{id:'TEST691-link'}]}:{})}]);
  await pool.query("INSERT INTO campaign_source_reviews(id,raw_code,status,campaign_id,config) VALUES(:p1,'TEST691-alias','linked','TEST691-review',:p2)",['6'.repeat(64),{}]);
  await pool.query('INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(:p1,:p2)', ['TEST691-link','TEST691-links']);
  await pool.query('INSERT INTO campaign_promotion_short_links(short_code,p) VALUES(:p1,:p2)', ['dlt691','TEST691-link']);
  const {startMysqlApplication}=await import('../server/mysqlApplication.ts');
  const {server}=await startMysqlApplication();
  if(!server.listening)await new Promise<void>(r=>server.on('listening',r));
  const base='http://127.0.0.1:4592';
  const session=()=>{let cookie='';return async(path:string,method='GET',body?:any)=>{const r=await fetch(base+path,{method,headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];return {status:r.status,data:await r.json()};};};
  await test('#691 deletion checks saved reserved source and retains existing dependency/auth protection',async t=>{
    t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
    const manager=session(),sales=session();
    assert.equal((await manager('/api/crm/auth/login','POST',{loginId:'Suki',password:'Suki'})).status,200);
    assert.equal((await sales('/api/crm/auth/login','POST',{loginId:'Fadhil',password:'Fadhil'})).status,200);
    const row=async(id:string)=>(await pool.query('SELECT * FROM trial_campaigns WHERE id=:p1',[id])).rows[0];
    for(const id of ['organic','TEST691-home','TEST691-case']){
      const before=await row(id);
      assert.equal((await manager('/api/crm/campaigns/'+id,'DELETE')).status,403,id);
      assert.deepEqual(await row(id),before);
    }
    for(const id of ['TEST691-review']){
      const before=await row(id);
      assert.equal((await manager('/api/crm/campaigns/'+id,'DELETE')).status,409,id);
      assert.deepEqual(await row(id),before);
    }
    assert.equal((await sales('/api/crm/campaigns/TEST691-normal','DELETE')).status,403);
    assert.ok(await row('TEST691-normal'));
    assert.equal((await manager('/api/crm/campaigns/TEST691-normal','DELETE')).status,200);
    assert.equal(await row('TEST691-normal'),undefined);
    assert.equal((await manager('/api/crm/campaigns/TEST691-links','DELETE')).status,200);
    assert.equal(await row('TEST691-links'),undefined);
    assert.equal((await pool.query('SELECT campaign_id FROM campaign_promotion_index WHERE p=:p1',['TEST691-link'])).rows.length,0);
    assert.equal((await pool.query('SELECT short_code FROM campaign_promotion_short_links WHERE p=:p1',['TEST691-link'])).rows.length,0);
    assert.equal((await manager('/api/crm/campaigns/TEST691-missing','DELETE')).data.success,false);
    assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM outbox')).rows[0].n),0);
  });
}
