import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openTrialDatabase, transaction } from '../database.mjs';
import { migrate } from '../migrate.mjs';

test('real MySQL: idempotency, task uniqueness, transaction rollback and linked notification cancellation', {skip:!process.env.MYSQL_TRIAL_URL}, async t=>{
  const pool=await openTrialDatabase(process.env);
  try {
    await migrate(pool,new URL(process.env.MYSQL_TRIAL_URL).pathname.slice(1));
    const tag=randomUUID(),lead='TEST-'+tag,visitor='visitor-'+tag,conversation='conversation-'+tag;
    await transaction(pool,async c=>{
      const businessNumber='20990101-'+BigInt('0x'+tag.replaceAll('-','').slice(0,12)).toString().padStart(3,'0');
      await c.execute('INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)',[lead,businessNumber,JSON.stringify({id:lead,businessNumber,fullName:'TEST MySQL acceptance',owner:'Fadhil',currentStage:'New',tier:'R1',followUpLogs:[]})]);
      await c.execute("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[visitor,lead]);
      await c.execute('INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES(?,?,?,?)',[conversation,visitor,lead,'standalone_chat']);
    });
    await t.test('ten concurrent retries keep one message; identical text with a new ID remains',async()=>{
      const save=async request=>{
        try{await pool.execute("INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES(?,?,?,'user',?,'saved')",[randomUUID(),conversation,request,'same original text']);}
        catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;}
      };
      await Promise.all(Array.from({length:10},()=>save('request-1')));
      await save('request-2');
      const [rows]=await pool.execute('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=?',[conversation]);
      assert.equal(Number(rows[0].n),2);
    });
    await t.test('failure rolls back both business data and outbox',async()=>{
      const event=randomUUID();
      await assert.rejects(transaction(pool,async c=>{
        await c.execute("UPDATE portal_leads SET profile=JSON_SET(profile,'$.owner','Wigar') WHERE id=?",[lead]);
        await c.execute('INSERT INTO outbox(id,type,lead_id,payload) VALUES(?,?,?,?)',[event,'lead.changed',lead,'{}']);
        throw Error('injected transaction failure');
      }),/injected/);
      const [leads]=await pool.execute("SELECT profile->>'$.owner' AS owner FROM portal_leads WHERE id=?",[lead]);
      const [events]=await pool.execute('SELECT id FROM outbox WHERE id=?',[event]);
      assert.equal(leads[0].owner,'Fadhil');assert.equal(events.length,0);
    });
    await t.test('complete one of three tasks; other deadlines and notifications remain',async()=>{
      const ids=Array.from({length:3},()=>randomUUID());
      await transaction(pool,async c=>{
        for(const [index,kind] of ['handoff','booking','enrollment'].entries()){
          await c.execute("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES(?,?,?,'open','2099-01-01 03:00:00.123456')",[ids[index],lead,kind]);
          await c.execute("INSERT INTO outbox(id,type,lead_id,payload) VALUES(?,'task.created',?,?)",[ids[index],lead,JSON.stringify({taskId:ids[index]})]);
          await c.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(?,?,?,1,'lark','CRM_Leads_Update','2099-01-01 03:00:00.123456',?)",[ids[index],ids[index],'TEST-rule',JSON.stringify({taskId:ids[index]})]);
        }
      });
      await assert.rejects(pool.execute("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES(?,?,?,'open','2099-01-02')",[randomUUID(),lead,'handoff']),{code:'ER_DUP_ENTRY'});
      await transaction(pool,async c=>{
        await c.execute("UPDATE followup_tasks SET status='completed' WHERE id=? AND lead_id=? AND status='open'",[ids[0],lead]);
        await c.execute("UPDATE notification_jobs SET state='cancelled' WHERE snapshot->>'$.taskId'=? AND state='pending'",[ids[0]]);
      });
      const [tasks]=await pool.execute('SELECT id,status,due_at FROM followup_tasks WHERE lead_id=?',[lead]);
      assert.equal(tasks.filter(row=>row.status==='completed').length,1);
      assert.equal(tasks.filter(row=>row.status==='open').length,2);
      assert.ok(tasks.every(row=>row.due_at==='2099-01-01 03:00:00.123456'));
      const [jobs]=await pool.execute('SELECT state FROM notification_jobs WHERE event_id IN (?,?,?)',ids);
      assert.equal(jobs.filter(row=>row.state==='cancelled').length,1);
      assert.equal(jobs.filter(row=>row.state==='pending').length,2);
    });
  }finally{await pool.end();}
});
