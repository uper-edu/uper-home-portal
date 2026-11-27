import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,realpath,rm,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {basename,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import mysql from 'mysql2/promise';
import {buildTestBusinessSql} from '../scripts/prepare-empty-portal-business.mts';
import {verifyStartupDatabase} from '../cloud/mysql/startup-database.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const socket=process.env.MYSQL_NATIVE_TEST_ENV;
const isolated=socket && basename(socket)==='mysql.sock' && /^uper-empty-db\.[a-zA-Z0-9]+$/.test(basename(dirname(socket)));
const files=[
  'v20261126213651_empty_portal_schema.sql',
  'v20261126213844_empty_portal_system.sql',
  'v20261126213845_empty_portal_accounts.sql',
  'v20261127020339_threads_promotion_ids.sql',
];
const threadsRoutine='uper_threads_promotion_ids_20261127020339';
const oldThreadsIds=['threads-social-profile-bio-261110092327','threads-social-profile-bio-261110093006'];
const routineNames=['schema','system','accounts'].map(step=>'uper_bootstrap_empty_'+step+'_v20');
const expectedStaff={
  Eric:["Eric Wang",["finance"]],
  Ethan:["Ethan Xu",["crm_leader","cms_admin","access_admin","sales","academic_admin","finance"]],
  Fadhil:["Fadhil",["sales"]],
  Fenny:["Fenny",["academic_admin","cms_admin","hr_reader"]],
  Hao:["Hao Zhang",["finance"]],
  Monite:["Monite Min",["crm_leader","cms_admin","access_admin","sales","academic_admin","finance"]],
  Robert:["Robert Hui",["crm_leader","cms_admin","finance","access_admin","sales","academic_admin"]],
  Suki:["Suki Zhou",["crm_leader","finance","academic_admin"]],
  Tester:["Tester Uper",["crm_leader","sales"]],
  Wigar:["Wigar",["sales"]],
  Zainul:["Zainul",["sales"]],
};
const staffIds=Object.keys(expectedStaff);
const token=()=>randomBytes(20).toString('hex');

test('manual empty MySQL bootstrap, recovery and academic permissions',{
  skip:!isolated && 'Requires the approved private empty-bootstrap MySQL socket',
  timeout:90_000,
},async t=>{
  const directory=await realpath(dirname(socket));
  assert.equal(socket,join(directory,'mysql.sock'));
  assert.ok((await stat(socket)).isSocket());
  const admin=await mysql.createConnection({user:'root',socketPath:socket,dateStrings:true});
  const schemas=[];
  let credentialDir,user,app;
  t.after(async()=>{
    try {
      if(app)await stop(app);
      for(const name of schemas.reverse())await admin.query('DROP DATABASE '+mysql.escapeId(name));
      if(user)await admin.query('DROP USER '+mysql.escape(user)+'@localhost');
      if(credentialDir)await rm(credentialDir,{recursive:true,force:true});
    }finally{await admin.end();}
  });
  const [[server]]=await admin.query('SELECT @@datadir AS datadir,@@skip_networking AS isolated,@@event_scheduler AS scheduler');
  assert.equal(await realpath(server.datadir),join(directory,'data'));
  assert.equal(Number(server.isolated),1);
  assert.equal(server.scheduler,'OFF');

  const [schema,system,accounts,threads]=await Promise.all(files.map(file=>readFile(join(root,'sql',file),'utf8')));
  const forward="SET @uper_threads_direction='forward';\n"+threads;
  const reverse="SET @uper_threads_direction='reverse';\n"+threads;
  const sha=value=>createHash('sha256').update(value).digest('hex');
  const binary=name=>join(process.env.MYSQL_BIN_DIRECTORY ?? '.',name);
  assert.ok(process.env.MYSQL_BIN_DIRECTORY,'Set the matching MySQL client bin directory');
  const cliFlags=['--no-defaults','--no-login-paths','--protocol=SOCKET','--socket='+socket,'--user=root'];
  function run(name,sql,{expected=name,failure}={}) {
    const result=spawnSync(binary('mysql'),[...cliFlags,'--batch','--default-character-set=utf8mb4',
      '--init-command='+ "SET @uper_expected_database="+mysql.escape(expected)+", @uper_environment='test'",name],
      {input:sql,encoding:'utf8',timeout:20_000});
    if(result.error&&!(failure&&result.error.code==='EPIPE'&&result.stderr))throw result.error;
    if(failure){
      assert.notEqual(result.status,0);
      assert.match(result.stderr,failure);
    }else assert.equal(result.status,0,result.stderr);
  }
  async function createSchema(){
    const name='uper_trial_empty_'+token().slice(0,10);
    await admin.query('CREATE DATABASE '+mysql.escapeId(name)+' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin');
    schemas.push(name);
    return name;
  }
  async function useSchema(name){
    await admin.query('USE '+mysql.escapeId(name));
  }
  async function count(table){
    const [[{n}]]=await admin.query('SELECT COUNT(*) AS n FROM '+mysql.escapeId(table));
    return Number(n);
  }
  async function tableCount(name){
    const [[{n}]]=await admin.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?',[name]);
    return Number(n);
  }
  async function removeFixtureRoutine(name){
    const [[created]]=await admin.query('SHOW CREATE PROCEDURE '+mysql.escapeId(name));
    assert.match(created['Create Procedure'],/uper:empty-v20:20261126213651/);
    await admin.query('DROP PROCEDURE '+mysql.escapeId(name));
  }
  function persisted(name){
    const result=spawnSync(binary('mysqldump'),[...cliFlags,'--skip-comments','--skip-lock-tables',
      '--no-tablespaces','--order-by-primary',name],{timeout:15_000});
    if(result.error)throw result.error;
    assert.equal(result.status,0,result.stderr.toString());
    return sha(result.stdout);
  }

  const primary=await createSchema();
  const existing=await createSchema();
  await t.test('wrong target and unowned same-named table are untouched',async()=>{
    run(existing,schema,{expected:primary,failure:/Invalid JSON text/});
    assert.equal(await tableCount(existing),0);
    await useSchema(existing);
    const [[{n}]]=await admin.query('SELECT COUNT(*) n FROM information_schema.routines WHERE ROUTINE_SCHEMA=DATABASE()');
    assert.equal(Number(n),0);
    await admin.query('CREATE TABLE crm_users(id VARCHAR(20) PRIMARY KEY);');
    await admin.query("INSERT INTO crm_users VALUES('preserve')");
    const before=persisted(existing);
    run(existing,schema,{failure:/not owned by this empty bootstrap/});
    assert.equal(persisted(existing),before);
    await removeFixtureRoutine(routineNames[0]);
    run(existing,system,{failure:/matching hand-reviewed empty database schema/});
    assert.equal(persisted(existing),before);
    await removeFixtureRoutine(routineNames[1]);
  });

  user='empty_'+token().slice(0,10);
  const dbPassword=token();
  await admin.query('CREATE USER '+mysql.escape(user)+'@localhost IDENTIFIED BY '+mysql.escape(dbPassword));
  // Runtime can perform ordinary operations, but cannot create or change schema objects.
  await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON '+mysql.escapeId(primary)+'.* TO '+mysql.escape(user)+'@localhost');
  await admin.query('GRANT SELECT ON performance_schema.* TO '+mysql.escape(user)+'@localhost');
  async function launch(){
    const temporary=createServer();
    temporary.listen(0,'127.0.0.1');
    await once(temporary,'listening');
    const {port}=temporary.address();
    await new Promise(resolve=>temporary.close(resolve));
    const url='http://127.0.0.1:'+port;
    const child=spawn(process.execPath,['--import','tsx','server.ts'],{
      cwd:root,
      env:{PATH:process.env.PATH,APP_ENV:'test',TRIAL_DATASET:'synthetic',PLATFORM_MODE:'local',
        PORTAL_ENV:'test',PORTAL_DATABASE_DRIVER:'mysql',PORTAL_ENV_SOURCE:'injected',
        MYSQL_TRIAL_URL:'mysql://'+user+':'+dbPassword+'@localhost/'+primary,MYSQL_TRIAL_SOCKET:socket,
        APP_URL:url,PORT:String(port)},
      stdio:['ignore','pipe','pipe'],
    });
    let output='';
    child.stdout.on('data',data=>output+=data);
    child.stderr.on('data',data=>output+=data);
    const done=once(child,'exit');
    return {child,url,done,output:()=>output};
  }
  async function stop(service){
    if(service.child.exitCode===null && service.child.signalCode===null)service.child.kill('SIGTERM');
    await service.done;
  }
  async function refuses(reason){
    const service=await launch();
    app=service;
    const [code]=await service.done;
    app=undefined;
    assert.notEqual(code,0);
    assert.match(service.output(),reason);
    assert.doesNotMatch(service.output(),/app\.ready/);
  }

  await t.test('empty and partially built databases fail before listening; verified DDL resumes',async()=>{
    await refuses(/missing or incompatible table/);
    const interrupted=schema.replace('    CREATE TABLE IF NOT EXISTS \x60access_handovers\x60',
      "    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture interrupted DDL';\n    CREATE TABLE IF NOT EXISTS \x60access_handovers\x60");
    assert.notEqual(interrupted,schema);
    run(primary,interrupted,{failure:/fixture interrupted DDL/});
    assert.equal(await tableCount(primary),1);
    await useSchema(primary);
    assert.equal(await count('trial_schema_versions'),0);
    await refuses(/missing or incompatible table/);
    await removeFixtureRoutine(routineNames[0]);
    const before=persisted(primary);
    await admin.query('ALTER TABLE trial_schema_versions ADD COLUMN unexpected INT');
    run(primary,schema,{failure:/Table structure differs/});
    await removeFixtureRoutine(routineNames[0]);
    await admin.query('ALTER TABLE trial_schema_versions DROP COLUMN unexpected');
    assert.equal(persisted(primary),before);
    run(primary,schema);
    assert.equal(await tableCount(primary),70);
    assert.equal(await count('trial_schema_versions'),20);
    await refuses(/CMS collection/);
  });

  await t.test('system transaction rolls back on interruption; account gate remains closed',async()=>{
    const before=persisted(primary);
    run(primary,system.replace('  COMMIT;\nEND//',
      "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture interrupted system defaults';\nEND//"),
      {failure:/fixture interrupted system defaults/});
    await removeFixtureRoutine(routineNames[1]);
    assert.equal(persisted(primary),before);
    run(primary,system);
    await refuses(/promotion preset bio-th/);
    run(primary,forward);
    await refuses(/unprepared accounts setting/);
  });

  await t.test('Threads ID cutover rolls back conflicts, preserves legacy links and is reversible before traffic',async()=>{
    const campaignDb=await createSchema();
    run(campaignDb,schema);
    run(campaignDb,system);
    await useSchema(campaignDb);
    const clearFailedRoutine=async()=>{
      const [[row]]=await admin.query('SHOW CREATE PROCEDURE '+mysql.escapeId(threadsRoutine));
      assert.match(row['Create Procedure'],/uper:threads:20261127020339/);
      await admin.query('DROP PROCEDURE '+mysql.escapeId(threadsRoutine));
    };
    await admin.execute("INSERT INTO campaign_promotion_short_links(short_code,p) VALUES('abc234',?)",[oldThreadsIds[0]]);
    await admin.execute("INSERT INTO portal_leads(id,business_number,profile) VALUES('history','TEST-HISTORY',JSON_OBJECT('promotionLinkId',?))",[oldThreadsIds[0]]);
    const original=persisted(campaignDb);
    run(campaignDb,forward,{expected:primary,failure:/Invalid JSON text/});
    assert.equal(persisted(campaignDb),original);
    await admin.query("INSERT INTO campaign_promotion_index(p,campaign_id) VALUES('chat-th','organic')");
    const conflicting=persisted(campaignDb);
    run(campaignDb,forward,{failure:/ownership conflict/});
    await clearFailedRoutine();
    assert.equal(persisted(campaignDb),conflicting);
    await admin.query("DELETE FROM campaign_promotion_index WHERE p='chat-th'");
    assert.equal(persisted(campaignDb),original);
    run(campaignDb,forward);
    const migrated=persisted(campaignDb);
    assert.notEqual(migrated,original);
    assert.deepEqual((await admin.query("SELECT p FROM campaign_promotion_short_links WHERE short_code='abc234'"))[0],[{p:'bio-th'}]);
    assert.equal((await admin.query("SELECT profile FROM portal_leads WHERE id='history'"))[0][0].profile.promotionLinkId,oldThreadsIds[0]);
    assert.equal(await count('campaign_promotion_index'),14);
    run(campaignDb,forward);
    assert.equal(persisted(campaignDb),migrated);
    run(campaignDb,reverse);
    assert.equal(persisted(campaignDb),original);
    run(campaignDb,reverse);
    assert.equal(persisted(campaignDb),original);
    run(campaignDb,forward);
    await admin.query("UPDATE portal_leads SET profile=JSON_SET(profile,'$.promotionLinkId','bio-th') WHERE id='history'");
    const serving=persisted(campaignDb);
    run(campaignDb,reverse,{failure:/Short Threads IDs are already in use/});
    await clearFailedRoutine();
    assert.equal(persisted(campaignDb),serving);
    await useSchema(primary);
  });

  credentialDir=await mkdtemp(join(directory,'account-fixture-'));
  const pass=Object.fromEntries(staffIds.map(id=>[id,'Temp!A1-'+token()]));
  const input=join(credentialDir,'passwords.json');
  await writeFile(input,JSON.stringify(pass),{mode:0o600});
  const privateSql=join(credentialDir,'accounts.sql');
  const prepared=spawnSync(process.execPath,['--import','tsx','scripts/prepare-empty-portal-accounts.mts',input,privateSql],
    {cwd:root,encoding:'utf8',timeout:10_000});
  assert.equal(prepared.status,0,prepared.stderr);
  const payload=await readFile(privateSql,'utf8');

  await t.test('account transaction rolls back all rows, then applies the approved roster',async()=>{
    const interrupted=accounts.replace('  INSERT INTO portal_audit(',
      "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture interrupted accounts';\n  INSERT INTO portal_audit(");
    assert.notEqual(interrupted,accounts);
    run(primary,payload+interrupted,{failure:/fixture interrupted accounts/});
    await removeFixtureRoutine(routineNames[2]);
    assert.equal(await count('access_roles'),0);
    assert.equal(await count('crm_users'),0);
    assert.equal(await count('access_state'),1);
    assert.equal(await count('portal_audit'),0);
    await refuses(/unprepared accounts setting/);
    run(primary,payload+accounts);
    assert.equal(await count('access_roles'),7);
    assert.equal(await count('crm_users'),staffIds.length);
    assert.equal(await count('access_state'),staffIds.length+2);
  });

  const initial=persisted(primary);
  run(primary,schema);
  run(primary,system);
  run(primary,payload+accounts);
  assert.equal(persisted(primary),initial);

  await t.test('real app health, first password change and five academic grants without sales escalation',async()=>{
    app=await launch();
    let health;
    for(let i=0;i<100;i++){
      if(app.child.exitCode!==null)break;
      health=await fetch(app.url+'/api/health').catch(()=>null);
      if(health?.ok)break;
      await delay(100);
    }
    assert.equal(health?.status,200,app.output());
    assert.equal((await health.json()).status,'ok');
    for(const [index,id] of ['bio-th','chat-th'].entries()){
      for(const slug of [id,oldThreadsIds[index]]){
        const response=await fetch(app.url+'/s/'+slug,{redirect:'manual'});
        assert.equal(response.status,302);
        const landing=new URL(response.headers.get('location'),app.url);
        assert.equal(landing.pathname,index===0?'/link':'/chat');
        assert.equal(landing.searchParams.get('p'),id);
        assert.equal(landing.searchParams.get('utm_source'),'threads');
        assert.equal(landing.searchParams.get('utm_campaign'),'social-bio');
        const promotion=await fetch(app.url+'/api/promotion-links/'+slug);
        assert.equal((await promotion.json()).promotion.id,id);
      }
    }

    function client(){
      let cookie='';
      return async(path,body)=>{
        const response=await fetch(app.url+path,{
          method:body?'POST':'GET',
          headers:{Origin:app.url,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
          body:body?JSON.stringify(body):undefined,
        });
        if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
        return {status:response.status,data:await response.json()};
      };
    }
    for(const id of staffIds){
      const request=client();
      const login=await request('/api/crm/auth/login',{loginId:id,password:pass[id]});
      assert.equal(login.status,200);
      assert.equal(login.data.employee.passwordChangeRequired,true);
      assert.deepEqual(login.data.employee.permissions,[]);
      assert.equal((await request('/api/crm/enrollment/classes')).status,403);
      const nextPassword='Changed!B2-'+token();
      const changed=await request('/api/crm/auth/password',{
        currentPassword:pass[id],newPassword:nextPassword,operationId:randomUUID(),
      });
      assert.equal(changed.status,200,JSON.stringify(changed.data));
      const after=await request('/api/crm/auth/me');
      assert.equal(after.data.employee.passwordChangeRequired,false);
      const [displayName,expectedRoles]=expectedStaff[id];
      assert.equal(after.data.employee.displayName,displayName);
      assert.deepEqual([...after.data.employee.roles].sort(),[...expectedRoles].sort());
      if(expectedRoles.includes('crm_leader')){
        assert.deepEqual(after.data.employee.grants['crm.dashboard.kpi.manage'],['all']);
      }
      if(id==='Robert'){
        const historical={lead:'threads-older',order:randomUUID(),promotion:oldThreadsIds[0]};
        const current={lead:'threads-newer',order:randomUUID(),promotion:'bio-th'};
        const entries=[historical,current];
        try{
          for(const entry of entries){
            await admin.execute('INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)',[
              entry.lead,entry.lead,JSON.stringify({id:entry.lead,campaignId:'social-bio',promotionLinkStatus:'verified',promotionLinkId:entry.promotion}),
            ]);
            await admin.execute("INSERT INTO enrollment_customer_records(kind,record_id,lead_id,created_at) VALUES('order',?,?,UTC_TIMESTAMP(6))",[entry.order,entry.lead]);
            await admin.execute("INSERT INTO enrollment_record_attribution(kind,record_id,attribution) VALUES('order',?,?)",[
              entry.order,JSON.stringify({campaignId:'social-bio',promotionId:entry.promotion,verified:true}),
            ]);
          }
          await admin.execute("INSERT INTO enrollment_notification_receipts(event_key,channel,kind,subject_id,payload,state,recorded_at) VALUES('threads-fixture','email','payment_confirmed',?,JSON_OBJECT(),'accepted',UTC_TIMESTAMP(6))",[historical.order]);
          const campaign=await request('/api/crm/campaigns/social-bio');
          assert.equal(campaign.status,200,JSON.stringify(campaign.data));
          const report=campaign.data.campaign.promotionResults;
          assert.equal(report.find(row=>row.key==='bio-th').customers,2);
          assert.deepEqual(report.find(row=>row.key==='bio-th').enrollmentJourney,{submitted:2,seats:2,confirmed:1});
          assert.equal(report.some(row=>row.key===oldThreadsIds[0]||row.key===':unverified'),false);
        }finally{
          await admin.query("DELETE FROM enrollment_notification_receipts WHERE event_key='threads-fixture'");
          for(const {lead,order} of entries){
            await admin.execute('DELETE FROM enrollment_record_attribution WHERE record_id=?',[order]);
            await admin.execute('DELETE FROM enrollment_customer_records WHERE record_id=?',[order]);
            await admin.execute('DELETE FROM portal_leads WHERE id=?',[lead]);
          }
        }
      }
      const classes=await request('/api/crm/enrollment/classes');
      if(!expectedRoles.includes('academic_admin')){
        assert.equal(classes.status,403);
        assert.equal((await request('/api/crm/courses',{id:'unauthorized'})).status,403);
      }else{
        assert.deepEqual(after.data.employee.grants['academics.manage'],['all']);
        assert.equal(classes.status,200);
        assert.equal(classes.data.courses.filter(course=>course.id!=='bootstrap-review').length,4);
        assert.equal((await request('/api/crm/enrollment/faculty')).status,200);
        if(id==='Fenny'){
          const course=await request('/api/crm/courses',{
            id:'bootstrap-review',revision:0,requestId:randomUUID(),
            config:{name:'Synthetic bootstrap course',sessions:4,price:100000,active:false,
              maxDiscountBps:0,maxDiscountAmount:null},
          });
          assert.equal(course.status,200,JSON.stringify(course.data));
          assert.ok((await request('/api/crm/enrollment/classes')).data.courses.some(course=>course.id==='bootstrap-review'));
        }
      }
      assert.equal((await client()('/api/crm/auth/login',{loginId:id,password:pass[id]})).status,401);
    }
    await stop(app);
    app=undefined;
  });

  await t.test('database contents are stable on rerun after changes; no customers or real deliveries',async()=>{
    await admin.query("UPDATE access_roles SET revision=revision+1 WHERE id='academic_admin'");
    await admin.query("UPDATE crm_users SET roles=JSON_ARRAY('cms_admin') WHERE id='Fenny'");
    const changed=persisted(primary);
    run(primary,schema);
    run(primary,system);
    run(primary,payload+accounts);
    assert.equal(persisted(primary),changed);
    for(const table of ['portal_leads','enrollment_orders','notification_jobs','outbox','enrollment_mail_attempts']){
      assert.equal(await count(table),0);
    }
  });

  await t.test('company-test business merge is atomic, target-bound and preserves later edits',async()=>{
    const business=await createSchema();
    run(business,schema);
    const [courses]=await admin.query('SELECT id,revision,value FROM crm_courses ORDER BY id');
    const seed={
      courses,classes:[],settings:[],media:[],
      cms:(await admin.query('SELECT * FROM cms_collections ORDER BY name'))[0],
      campaigns:(await admin.query('SELECT * FROM trial_campaigns ORDER BY id'))[0],
      promotion:(await admin.query('SELECT * FROM campaign_promotion_index ORDER BY p'))[0],
      rules:(await admin.query('SELECT * FROM notification_rules ORDER BY id'))[0],
      channels:(await admin.query('SELECT * FROM notification_channels ORDER BY id'))[0],
      mail:(await admin.query('SELECT * FROM enrollment_mail_configuration'))[0],
    };
    const date='2026-11-20 12:00:00.000000';
    seed.classes.push({id:'fixture-expired',course_id:courses[0].id,revision:4,state:'published',
      first_lesson_at:date,enrollment_closes_at:date,updated_at:date,data:{teacherId:'fixture',timezone:'Asia/Jakarta'}});
    const data=Buffer.from('a simulated attachment').toString('base64');
    seed.settings.push(
      {id:'sla',value:{hotHours:2,warmHours:48,coldHours:72}},
      {id:'lark_personal_channel',value:{mode:'simulation',revision:1}},
      {id:'faculty:profile:fixture',value:{name:'Fixture Teacher'}},
      {id:'faculty:photo:fixture',value:{data}},
      {id:'faculty:cv:fixture',value:{data}},
    );
    seed.cms[0].items=[{name:'Example page'}];
    seed.rules[0].enabled=1;
    const privateSeed=buildTestBusinessSql(seed,business);
    const wrong=buildTestBusinessSql(seed,existing);
    const before=persisted(business);
    run(business,wrong.sql+system,{failure:/Invalid JSON text/});
    assert.equal(persisted(business),before);
    run(business,'SET @uper_require_business_defaults=1;\n'+system,{failure:/Load the required private business defaults/});
    await useSchema(business);
    await removeFixtureRoutine(routineNames[1]);
    assert.equal(persisted(business),before);
    const interrupted=system.replace('  COMMIT;\nEND//',
      "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture interrupted business defaults';\nEND//");
    run(business,privateSeed.sql+interrupted,{failure:/fixture interrupted business defaults/});
    await useSchema(business);
    await removeFixtureRoutine(routineNames[1]);
    assert.equal(persisted(business),before);
    run(business,privateSeed.sql+system);
    run(business,forward);
    run(business,payload+accounts);
    await verifyStartupDatabase(admin,business,{PORTAL_ENV:'test',PLATFORM_MODE:'local'});
    assert.equal(await count('enrollment_classes'),1);
    const [[{enrollment_closes_at:deadline,revision}]]=await admin.query('SELECT enrollment_closes_at,revision FROM enrollment_classes');
    assert.equal(deadline,date);
    assert.equal(revision,4);
    const [files]=await admin.query("SELECT value FROM portal_settings WHERE id IN ('faculty:photo:fixture','faculty:cv:fixture')");
    assert.deepEqual(files.map(row=>row.value.data),[data,data]);
    assert.equal(await count('campaign_promotion_index'),seed.promotion.length);
    for(const table of ['enrollment_orders','enrollment_class_openings','portal_leads','enrollment_proofs','integration_credentials','notification_jobs']){
      assert.equal(await count(table),0,table);
    }
    await admin.query("UPDATE enrollment_classes SET revision=5 WHERE id='fixture-expired'");
    await admin.query("DELETE FROM portal_settings WHERE id='faculty:photo:fixture'");
    await admin.query("UPDATE portal_settings SET value=JSON_SET(value,'$.hotHours',5) WHERE id='sla'");
    const edited=persisted(business);
    run(business,privateSeed.sql+system);
    run(business,payload+accounts);
    assert.equal(persisted(business),edited);
    seed.settings[0].value.hotHours=99;
    run(business,buildTestBusinessSql(seed,business).sql+system,{failure:/initialized with different business defaults/});
    await removeFixtureRoutine(routineNames[1]);
    assert.equal(persisted(business),edited);
  });
});
