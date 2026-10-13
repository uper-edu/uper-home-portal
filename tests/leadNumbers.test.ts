import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { leadDisplayNumber } from '../src/utils/leadNumber';
import { formatCrmOperatingTime } from '../src/utils/crmOperatingTime';

test('CRM displays the business number while retaining internal and legacy fallback IDs',()=>{
  const id=randomUUID();
  assert.equal(leadDisplayNumber({id,businessNumber:'20261013-001'}),'20261013-001');
  assert.equal(leadDisplayNumber({id}),id);
  assert.equal(leadDisplayNumber({id:'UPER-20260930-005'}),'20260930-005');
});

test('CRM timestamp dates match Operating Timezone across midnight and daylight saving',()=>{
  const stamp='2038-05-01T16:30:00Z';
  assert.equal(formatCrmOperatingTime(stamp,'Asia/Jakarta'),'2038-05-01 23:30:00');
  assert.equal(formatCrmOperatingTime(stamp,'Asia/Shanghai'),'2038-05-02 00:30:00');
  assert.equal(formatCrmOperatingTime('2026-03-08T09:59:59Z','America/Vancouver'),'2026-03-08 01:59:59');
  assert.equal(formatCrmOperatingTime('2026-03-08T10:00:00Z','America/Vancouver'),'2026-03-08 03:00:00');
  assert.equal(formatCrmOperatingTime(undefined,'Asia/Jakarta'),'');
});

if(process.env.LEAD_NUMBERS_TEST_DATABASE_URL){
  const database=new URL(process.env.LEAD_NUMBERS_TEST_DATABASE_URL);
  if(database.hostname!=='127.0.0.1'||database.port!=='5448'||!/^\/uper_lead_numbers_test_[a-z0-9_]+$/.test(database.pathname))throw Error('Explicit isolated lead-number test database required');
  process.env.DATABASE_URL=database.toString();process.env.PLATFORM_MODE='mock';
  const {pool,initialize}=await import('../server/portal/store.ts');
  const {mountPortal}=await import('../server/portal/runtime.ts');
  const {backupPortal,backupTables}=await import('../server/portal/backup.ts');
  await test('Operating Timezone daily business numbers in isolated PostgreSQL',async t=>{
    assert.equal((await pool.query("SELECT count(*) n FROM pg_tables WHERE schemaname='public'")).rows[0].n,'0');
    await pool.query(await fs.readFile('server/portal/schema.sql','utf8'));
    const {defaults}=await import('../server/portal/policy.ts');
    await pool.query("INSERT INTO portal_settings(id,value) VALUES('sla',$1)",[{...defaults,timezone:'Asia/Shanghai',hotHours:3,warmHours:24,coldHours:48}]);
    const historical=[
      {id:randomUUID(),submittedAt:'2032-10-12T16:59:59Z',fullName:'TEST before Jakarta midnight'},
      {id:'20261012-0123',submittedAt:'2032-10-12T17:00:00Z',fullName:'TEST at Jakarta midnight'},
      {id:randomUUID(),submittedAt:'2032-10-12T18:00:00Z',fullName:'TEST after midnight'},
      {id:randomUUID(),submittedAt:'2032-99-99T00:00:00Z',fullName:'TEST invalid original timestamp'},
    ];
    for(const profile of [...historical].reverse())await pool.query('INSERT INTO portal_leads(id,profile,created_at) VALUES($1,$2,$3)',[profile.id,profile,'2032-10-15T01:00:00Z']);
    await pool.query("INSERT INTO visitor_sessions VALUES('number-history-visitor',$1,'2040-01-01')",[historical[0].id]);
    await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('number-history-conv','number-history-visitor',$1,'standalone_chat')",[historical[0].id]);
    await pool.query("INSERT INTO hsk_attempts(id,visitor_id,lead_id,input_hash,attempt,result) VALUES('number-history-attempt','number-history-visitor',$1,'fixture','{}','{}')",[historical[0].id]);
    await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES('number-history-task',$1,'follow_up','2040-01-01')",[historical[0].id]);
    await initialize();
    const app=express();app.use(express.json());await mountPortal(app);
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
    const base='http://127.0.0.1:'+(server.address() as any).port;
    t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
    async function request(route:string,cookie='',method='GET',body?:object){const res=await fetch(base+route,{method,headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||cookie};}
    async function saveTimezone(timezone:string){const configured=(await request('/api/crm/policy-config')).data;configured.businessHours.timezone=timezone;assert.equal((await request('/api/crm/policy-config','','POST',configured)).status,200);}
    await t.test('historical backfill follows configured Shanghai dates and preserves every original ID and relation',async()=>{
      const expected=['20321013-001','20321013-002','20321013-003','20321015-001'];
      for(const [i,old] of historical.entries()){
        const row=(await pool.query('SELECT id,profile,business_number FROM portal_leads WHERE id=$1',[old.id])).rows[0];
        assert.equal(row.id,old.id);assert.equal(row.business_number,expected[i]);
        assert.deepEqual(row.profile,{...old,businessNumber:expected[i]});
      }
      for(const table of ['visitor_sessions','conversations','hsk_attempts','followup_tasks'])assert.equal((await pool.query(`SELECT lead_id FROM ${table}`)).rows[0].lead_id,historical[0].id);
    });
    await t.test('24 concurrent inserts receive unique sequential numbers with UUIDs unchanged',async()=>{
      const rows=await Promise.all(Array.from({length:24},async()=>{
        const id=randomUUID();return (await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING *',[id,{id,submittedAt:'2033-03-04T06:00:00Z',businessNumber:'FORGED'}])).rows[0];
      }));
      assert.equal(new Set(rows.map(r=>r.business_number)).size,24);
      assert.deepEqual(rows.map(r=>r.business_number).sort(),Array.from({length:24},(_,i)=>'20330304-'+String(i+1).padStart(3,'0')));
      assert.ok(rows.every(r=>r.id===r.profile.id && r.business_number===r.profile.businessNumber));
    });
    await t.test('rollback does not consume a number; retries and profile edits do not renumber',async()=>{
      const c=await pool.connect();
      try{await c.query('BEGIN');await c.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2)',[randomUUID(),{submittedAt:'2034-01-01T00:00:00Z'}]);await c.query('ROLLBACK');}finally{c.release();}
      const id=randomUUID(),profile={id,submittedAt:'2034-01-01T00:00:00Z'};
      assert.equal((await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number',[id,profile])).rows[0].business_number,'20340101-001');
      for(let n=0;n<3;n++)await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET profile=excluded.profile',[id,{...profile,businessNumber:'FORGED'}]);
      await pool.query("UPDATE portal_leads SET business_number='99999999-999',profile=profile || '{\"businessNumber\":\"FORGED\",\"submittedAt\":\"2035-01-01T00:00:00Z\"}' WHERE id=$1",[id]);
      const row=(await pool.query('SELECT * FROM portal_leads WHERE id=$1',[id])).rows[0];assert.equal(row.business_number,'20340101-001');assert.equal(row.profile.businessNumber,row.business_number);
      assert.equal((await pool.query("SELECT last_value FROM lead_daily_counters WHERE business_date='20340101'")).rows[0].last_value,'1');
      await assert.rejects(pool.query('UPDATE portal_leads SET id=$2 WHERE id=$1',[id,randomUUID()]),/immutable/);
    });
    await t.test('sequences reset at Jakarta midnight and expand past 999 without truncation',async()=>{
      await saveTimezone('Asia/Jakarta');
      const before=(await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number',[randomUUID(),{submittedAt:'2036-08-01T16:59:59Z'}])).rows[0].business_number;
      const after=(await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number',[randomUUID(),{submittedAt:'2036-08-01T17:00:00Z'}])).rows[0].business_number;
      assert.equal(before,'20360801-001');assert.equal(after,'20360802-001');
      await pool.query("INSERT INTO portal_leads(id,profile,business_number) VALUES($1,'{}','20370101-999')",[randomUUID()]);
      assert.equal((await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number',[randomUUID(),{submittedAt:'2037-01-01T00:00:00Z'}])).rows[0].business_number,'20370101-1000');
    });
    await t.test('Sales Operations timezone changes take effect immediately without renumbering or reusing a date sequence',async()=>{
      const stamp='2038-05-01T16:30:00Z';
      const add=async()=> (await pool.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING id,business_number',[randomUUID(),{submittedAt:stamp}])).rows[0];
      await saveTimezone('Asia/Jakarta');const jakarta=await add();assert.equal(jakarta.business_number,'20380501-001');
      await saveTimezone('Asia/Shanghai');const shanghai=await add();assert.equal(shanghai.business_number,'20380502-001');
      await saveTimezone('Asia/Jakarta');assert.equal((await add()).business_number,'20380501-002');
      assert.equal((await pool.query('SELECT business_number FROM portal_leads WHERE id=$1',[jakarta.id])).rows[0].business_number,jakarta.business_number);
      assert.equal((await pool.query('SELECT business_number FROM portal_leads WHERE id=$1',[shanghai.id])).rows[0].business_number,shanghai.business_number);
    });
    await t.test('contact retries share a single UUID and CRM searches, detail and exports include business number',async()=>{
      const session=await request('/api/portal/session');
      const contact={fullName:'TEST BUSINESS NUMBER',email:'number@example.invalid',businessNumber:'FORGED',submittedAt:'1900-01-01T00:00:00Z'};
      const results=await Promise.all([0,1].map(()=>request('/api/portal/register',session.cookie,'POST',contact)));
      assert.ok(results.every(r=>r.status===200));
      const lead=results[0].data.lead;assert.match(lead.id,/^[0-9a-f-]{36}$/);assert.match(lead.businessNumber,/^\d{8}-\d{3,}$/);
      assert.equal(results[1].data.lead.id,lead.id);assert.equal(results[1].data.lead.businessNumber,lead.businessNumber);assert.ok(!lead.businessNumber.startsWith('1900'));
      const found=await request('/api/crm/leads?search='+lead.businessNumber);assert.equal(found.status,200);assert.deepEqual(found.data.leads.map((l:any)=>l.id),[lead.id]);
      const detail=await request('/api/crm/leads/'+lead.id);assert.equal(detail.data.lead.businessNumber,lead.businessNumber);
      const update=await request('/api/crm/leads/'+lead.id,'','PATCH',{businessNumber:'FORGED',id:'FORGED',currentStage:'Contacted'});assert.equal(update.status,200);assert.equal(update.data.lead.id,lead.id);assert.equal(update.data.lead.businessNumber,lead.businessNumber);
      const exported=await request('/api/crm/export');assert.equal(exported.data.find((l:any)=>l.id===lead.id).businessNumber,lead.businessNumber);
    });
    await t.test('initialization is idempotent and counters survive restarts',async()=>{
      const before=(await pool.query('SELECT id,business_number,profile FROM portal_leads ORDER BY id')).rows;
      const counters=(await pool.query('SELECT * FROM lead_daily_counters ORDER BY business_date')).rows;
      await initialize();await initialize();
      assert.deepEqual((await pool.query('SELECT id,business_number,profile FROM portal_leads ORDER BY id')).rows,before);
      assert.deepEqual((await pool.query('SELECT * FROM lead_daily_counters ORDER BY business_date')).rows,counters);
    });
    await t.test('current backup preserves numbers and counter high water; older snapshots receive compatible backfill',async()=>{
      const directory=await fs.mkdtemp(path.join(os.tmpdir(),'uper-lead-numbers-'));
      const snapshotFile=path.join(directory,'snapshot.json');await backupPortal(snapshotFile);
      const snapshot=JSON.parse(await fs.readFile(snapshotFile,'utf8'));
      assert.ok(snapshot.tables.includes('lead_daily_counters'));
      const adminUrl=new URL(database);adminUrl.pathname='/postgres';const admin=new pg.Client({connectionString:adminUrl.toString()});await admin.connect();
      const exec=promisify(execFile);
      try{
        for(const mode of ['current','legacy','old_counter']){
          const legacy=mode==='legacy';
          const name=database.pathname.slice(1)+'_'+mode;await admin.query('CREATE DATABASE '+name);
          const target=new URL(database);target.pathname='/'+name;
          const file=mode==='current'?snapshotFile:path.join(directory,mode+'.json');
          if(mode!=='current'){
            const old=structuredClone(snapshot);
            if(legacy){old.tables=old.tables.filter((x:string)=>x!=='lead_daily_counters');old.sourceTables=old.sourceTables.filter((x:string)=>x!=='lead_daily_counters');delete old.data.lead_daily_counters;delete old.columns.lead_daily_counters;
              old.columns.portal_leads=old.columns.portal_leads.filter((x:string)=>x!=='business_number');for(const row of old.data.portal_leads){delete row.business_number;delete row.profile.businessNumber;}
              old.data.portal_settings.find((r:any)=>r.id==='sla').value.timezone='Asia/Shanghai';
            }else{old.columns.lead_daily_counters=old.columns.lead_daily_counters.map((c:string)=>c==='business_date'?'jakarta_date':c);old.data.lead_daily_counters=old.data.lead_daily_counters.map(({business_date,...r}:any)=>({...r,jakarta_date:business_date}));}
            const {sha256,...payload}=old;old.sha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');await fs.writeFile(file,JSON.stringify(old));
          }
          await exec(process.execPath,['--import','tsx','scripts/portal-backup.ts','restore',file],{env:{...process.env,DATABASE_URL:target.toString()}});
          const c=new pg.Client({connectionString:target.toString()});await c.connect();
          try{
            const rows=(await c.query('SELECT * FROM portal_leads ORDER BY id')).rows;
            assert.equal(rows.length,snapshot.data.portal_leads.length);assert.ok(rows.every(r=>r.profile.businessNumber===r.business_number));
            if(legacy)assert.ok(rows.find(r=>r.id===historical[0].id).business_number.startsWith('20321013-'));
            if(!legacy){
              assert.deepEqual(rows.map(r=>r.business_number),[...snapshot.data.portal_leads].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.business_number));
              assert.equal((await c.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number',[randomUUID(),{submittedAt:'2037-01-01T00:00:00Z'}])).rows[0].business_number,'20370101-1001');
            }
            assert.equal((await c.query("SELECT lead_id FROM hsk_attempts WHERE id='number-history-attempt'")).rows[0].lead_id,historical[0].id);
            assert.ok(backupTables.includes('lead_daily_counters'));
          }finally{await c.end();}
        }
      }finally{await admin.end();}
    });
  });
}
