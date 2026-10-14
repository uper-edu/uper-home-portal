import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openTrialDatabase} from '../database.mjs';
import {newHskAttempt} from '../../../src/data/hskAssessment.ts';
import {getExamQuestions} from '../../../src/data/hskQuizQuestions.ts';

test('real MySQL portal API: registration, access scope, claiming, handoff and selected-task follow-up', {skip:!process.env.MYSQL_API_TEST}, async()=>{
  const base='http://127.0.0.1:4412';
  function browser(){const cookies=new Map();return async(path,body)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';')},body:body===undefined?undefined:JSON.stringify(body)});
    for(const header of response.headers.getSetCookie()){const [name,value]=header.split(';')[0].split('=');cookies.set(name,value);}
    const json=await response.json();return {status:response.status,json};
  };}
  const learner=browser(),leader=browser(),sales=browser(),otherSales=browser();
  const marker=randomUUID();
  assert.equal((await leader('/api/crm/auth/login',{loginId:'Robert',password:'Robert'})).status,200);
  assert.equal((await sales('/api/crm/auth/login',{loginId:'Fadhil',password:'Fadhil'})).status,200);
  assert.equal((await otherSales('/api/crm/auth/login',{loginId:'Wigar',password:'Wigar'})).status,200);
  const campaignId='TEST-'+marker;
  const campaign=await leader('/api/crm/campaigns',{name:'TEST MySQL Campaign',nameEn:'TEST MySQL Campaign',id:campaignId,code:campaignId,status:'active',locationType:'online'});
  assert.equal(campaign.status,200,JSON.stringify(campaign.json));
  assert.equal((await sales('/api/crm/campaigns',{name:'TEST unauthorized campaign'})).status,403);
  await Promise.all(Array.from({length:10},()=>learner('/api/campaigns/'+campaignId+'/impression',{})));
  const conversation=await learner('/api/portal/conversations',{source:'standalone_chat',campaign:campaignId});
  assert.equal(conversation.status,200,JSON.stringify(conversation.json));
  const registration=await learner('/api/portal/register',{fullName:'TEST MySQL API Learner',email:marker+'@example.invalid',whatsapp:'000000000',entryPoint:'standalone_chat',campaignId,goal:'Work in China',reportedLevel:'Beginner',levelState:'learned',city:'Jakarta',mode:'Online',currentStatus:'Working professional'});
  assert.equal(registration.status,200,JSON.stringify(registration.json));
  const lead=registration.json.lead;
  assert.match(lead.businessNumber,/^\d{8}-\d{3,}$/);
  const replay=await learner('/api/portal/register',{fullName:'TEST MySQL API Learner',email:marker+'@example.invalid',whatsapp:'000000000'});
  assert.equal(replay.json.lead.id,lead.id);assert.equal(replay.json.lead.businessNumber,lead.businessNumber);
  const attempt=newHskAttempt('full',randomUUID());
  for(const question of getExamQuestions('full'))attempt.answers[question.id]=question.options.find(o=>o.isCorrect).id;
  attempt.completedAt=new Date().toISOString();
  const assessed=await learner('/api/portal/assessments',{attempt,lang:'en'});
  assert.equal(assessed.status,200,JSON.stringify(assessed.json));
  assert.equal(assessed.json.result.score,100);
  const assessmentReplay=await learner('/api/portal/assessments',{attempt,lang:'zh'});
  assert.equal(assessmentReplay.status,200);
  const chatId='ai-'+marker;
  const chat=await learner('/api/chat',{conversationId:conversation.json.conversationId,messageId:chatId,content:'TEST: I would like to know the class schedule',lang:'en'});
  assert.equal(chat.status,200,JSON.stringify(chat.json));
  assert.equal(chat.json.modelUsed,'deepseek-chat');
  assert.equal(chat.json.status,'completed');
  assert.ok(!chat.json.reply.includes('FAILED PRIMARY PARTIAL'));
  assert.equal((await sales('/api/crm/leads/'+lead.id)).status,200);
  assert.equal((await sales('/api/crm/leads/'+lead.id+'/claim',{})).status,200);
  assert.equal((await otherSales('/api/crm/leads/'+lead.id)).status,404);
  assert.equal((await otherSales('/api/crm/leads/'+lead.id+'/claim',{})).status,404);
  const action={conversationId:conversation.json.conversationId,action:'handoff',messageId:marker,content:'Please ask a human adviser to contact me',language:'en'};
  const handoff=await learner('/api/portal/actions',action);
  assert.equal(handoff.status,200,JSON.stringify(handoff.json));
  assert.equal(handoff.json.status,'awaiting_advisor');
  const repeated=await learner('/api/portal/actions',action);
  assert.equal(repeated.json.taskId,handoff.json.taskId);
  const detail=await sales('/api/crm/leads/'+lead.id);
  assert.equal(detail.json.chatTranscript.filter(m=>m.request_id===marker).length,2);
  assert.equal(detail.json.tasks.filter(t=>t.status==='open').length,2);
  const remaining=detail.json.tasks.find(t=>t.id!==handoff.json.taskId);
  const jobs=new Map();
  const setupPool=await openTrialDatabase(process.env);
  try{
    const eventId=randomUUID();
    await setupPool.execute("INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(?,'TEST.pending-task',?,'{}',UTC_TIMESTAMP(6))",[eventId,lead.id]);
    for(const taskId of [handoff.json.taskId,remaining.id]){
      const jobId=randomUUID();jobs.set(taskId,jobId);
      await setupPool.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(?,?,?,1,'lark','CRM_Leads_Update','2099-01-01',?)",[jobId,eventId,'TEST-'+taskId,JSON.stringify({leadId:lead.id,payload:{taskId}})]);
    }
  }finally{await setupPool.end();}
  const followup={requestId:'followup-'+marker,channel:'WhatsApp',connectStatus:'Connected',summary:'TEST: learner replied; confirm schedule next time',completeTaskIds:[handoff.json.taskId],disposition:'keep'};
  const saved=await sales('/api/crm/leads/'+lead.id+'/logs',followup);
  assert.equal(saved.status,200,JSON.stringify(saved.json));
  assert.deepEqual(saved.json.completedTaskIds,[handoff.json.taskId]);
  const retries=await Promise.all(Array.from({length:10},()=>sales('/api/crm/leads/'+lead.id+'/logs',followup)));
  assert.ok(retries.every(r=>r.status===200));
  const final=await sales('/api/crm/leads/'+lead.id);
  assert.equal(final.json.lead.followUpLogs.filter(l=>l.requestId===followup.requestId).length,1);
  assert.equal(final.json.tasks.find(t=>t.id===handoff.json.taskId).status,'completed');
  assert.equal(final.json.tasks.find(t=>t.id===remaining.id).status,'open');
  assert.equal(final.json.tasks.find(t=>t.id===remaining.id).due_at,remaining.due_at);
  const list=await leader('/api/crm/leads');
  assert.equal(list.status,200,JSON.stringify(list.json));
  assert.ok(list.json.leads.some(l=>l.id===lead.id));
  const metrics=await leader('/api/crm/campaigns/'+campaignId);
  assert.equal(metrics.status,200,JSON.stringify(metrics.json));
  assert.equal(metrics.json.campaign.stats.impressions,10);
  assert.equal(metrics.json.campaign.stats.leadsCount,1);
  assert.equal(metrics.json.campaign.stats.assessedCount,1);
  const pool=await openTrialDatabase(process.env);
  try{
    const [notifications]=await pool.execute('SELECT id,state FROM notification_jobs WHERE id IN (?,?)',[jobs.get(handoff.json.taskId),jobs.get(remaining.id)]);
    assert.equal(notifications.find(j=>j.id===jobs.get(handoff.json.taskId)).state,'cancelled');
    assert.equal(notifications.find(j=>j.id===jobs.get(remaining.id)).state,'pending');
    const [rows]=await pool.execute("SELECT COUNT(*) n FROM portal_audit WHERE action='followup.save' AND data->>'$.leadId'=?",[lead.id]);assert.equal(Number(rows[0].n),1);
    const [messages]=await pool.execute("SELECT id,content,status FROM messages WHERE conversation_id=? AND request_id=? AND role='assistant'",[conversation.json.conversationId,chatId]);
    assert.equal(messages[0].status,'completed');assert.equal(messages[0].content,chat.json.reply);
    const [attempts]=await pool.execute('SELECT content,error FROM ai_attempts WHERE message_id=?',[messages[0].id]);
    assert.equal(attempts.length,2);
    const failed=attempts.find(row=>row.error);
    assert.equal(failed.content,'FAILED PRIMARY PARTIAL');
    assert.equal(attempts.find(row=>!row.error).content,chat.json.reply);
  }finally{await pool.end();}
});
