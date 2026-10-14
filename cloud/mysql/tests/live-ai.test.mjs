import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openTrialDatabase} from '../database.mjs';
test('real provider reply persists in MySQL and replay does not invoke a new attempt',{skip:!process.env.MYSQL_LIVE_AI_TEST},async()=>{
  const base='http://127.0.0.1:4412',cookies=new Map();
  const call=async(path,body)=>{
    const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';')},body:JSON.stringify(body)});
    for(const header of res.headers.getSetCookie()){const [k,v]=header.split(';')[0].split('=');cookies.set(k,v);}
    assert.equal(res.status,200);return res.json();
  };
  const conv=await call('/api/portal/conversations',{source:'standalone_chat'});
  const messageId='TEST-live-'+randomUUID();
  const body={conversationId:conv.conversationId,messageId,lang:'en',content:'TEST synthetic learner: I am interested in learning Mandarin online. Ask me one short question about my availability. Do not invent class dates.'};
  const result=await call('/api/chat',body);
  assert.equal(result.status,'completed');assert.ok(result.reply.length>10);
  assert.equal(result.modelUsed,process.env.MYSQL_EXPECTED_MODEL||'gpt-4o');
  assert.ok(!result.reply.includes('FAILED PRIMARY PARTIAL'));
  const replay=await call('/api/chat',body);assert.equal(replay.reply,result.reply);
  const pool=await openTrialDatabase(process.env);
  try{
    const [messages]=await pool.execute("SELECT id,content,status FROM messages WHERE conversation_id=? AND request_id=? AND role='assistant'",[conv.conversationId,messageId]);
    assert.equal(messages.length,1);assert.equal(messages[0].content,result.reply);assert.equal(messages[0].status,'completed');
    const [attempts]=await pool.execute('SELECT model,content,error FROM ai_attempts WHERE message_id=?',[messages[0].id]);
    assert.equal(attempts.filter(a=>!a.error).length,1);
    if(process.env.MYSQL_EXPECT_PRIMARY_FAILURE){
      assert.equal(attempts.length,2);assert.equal(attempts.find(a=>a.error).content,'FAILED PRIMARY PARTIAL');
    }else assert.equal(attempts.length,1);
    console.log(JSON.stringify({conversationId:conv.conversationId,messageId,modelUsed:result.modelUsed,successfulAttempts:1,failedAttempts:attempts.filter(a=>a.error).length,persisted:true,replayDeduplicated:true}));
  }finally{await pool.end();}
});
