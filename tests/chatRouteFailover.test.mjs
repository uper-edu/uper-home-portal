import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
import {enrollmentGuideHref} from '../src/utils/enrollmentGuidance.ts';

const fixtureKey = Symbol.for('uper.chatRouteFailover');
const database = `
  const get = () => globalThis[Symbol.for('uper.chatRouteFailover')];
  export const nativePool = {query: (...args) => get().query(...args)};
  export const pool = nativePool;
  export const connection = async () => ({client:nativePool,release:() => get().released++});
  export const id = () => 'fixture-' + (++get().sequence);
  export const event = async (_db,type,_lead,fields) => {get().events.push({type,...fields});};
  export const tx = () => {throw Error('Unexpected independent transaction');};
  export const initialize = () => {throw Error('Unexpected database startup');};
`;
const modules = new Map([
  ['/cloud/mysql/runtime.mjs',database],
  ['/server/portal/runtime.ts',`
    export const wrap = handler => handler;
    export const own = async () => ({id:'chat-fixture',visitor_id:'learner-fixture',source:'standalone_chat'});
    export const chatEntrySurface = async surface => surface;
    export const fail = (status,message) => {throw Object.assign(Error(message),{status});};
  `],
  ['/server/portal/aiServiceConfig.ts',`
    export const runtimeProviders = async () => [
      {model:'gpt-6-luna',provider:'openai',key:'mock-primary',url:'https://primary.invalid',reasoningEffort:'medium'},
      {model:'deepseek-v4-pro',provider:'deepseek',key:'mock-backup',url:'https://backup.invalid'},
    ];
    export const providerFor = () => {throw Error('Unexpected provider lookup');};
  `],
  ['/server/logger.ts',`
    const capture = (event,fields) => globalThis[Symbol.for('uper.chatRouteFailover')].logs.push({event,...fields});
    export const log = {info:capture,warn:capture,error:capture,debug:capture};
  `],
]);
const hooks = registerHooks({
  load(url, context, next) {
    for (const [suffix,source] of modules) {
      if (url.endsWith(suffix)) return {shortCircuit:true,format:'module',source};
    }
    return next(url,context);
  },
});
const {mountChat} = await import('../server/portal/chat.ts');
hooks.deregister();

const classData = {
  level:'HSK 1',format:'standard',period:'weekend',batchNumber:1,firstLesson:'2037-01-03T15:00',
  schedule:'Saturday, 15:00–16:30 WIB',weeklySchedule:{days:[6],start:'15:00',lessons:2},
  sessions:24,minutes:45,price:875000,standardPrice:950000,capacity:15,minimumPaid:9,
};
const classId = 'fixture-weekend';
const question = 'Can you recommend an HSK 1 weekend class?';
const recommendation = {
  reply:'Here is an HSK 1 option.',catalogue:null,replyLanguage:'en',suggestedPrompts:['How long is each session?'],
  enrollment:{kind:'recommend',level:'HSK 1',period:'weekend',maxRecommendations:1,fields:['first','weekly','price']},
};
const usage = {prompt_tokens:50,prompt_cache_hit_tokens:20,completion_tokens:15};
const response = (body, model) => Response.json({
  model, choices:[{message:{content:JSON.stringify(body)},finish_reason:'stop'}], usage,
});
function sse(content, done = true) {
  return new Response(`data: ${JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}],usage})}\n\n` +
    (done ? 'data: [DONE]\n\n' : ''), {headers:{'Content-Type':'text/event-stream'}});
}

function mountFixture(t, bothFail = false) {
  const priorHistory=[],messages=[],attempts=[],events=[],logs=[],calls=[],sqlTrace=[];
  const fixture = {
    events,logs,released:0,sequence:0,
    async query(sql,args = []) {
      if (sql.startsWith('SELECT GET_LOCK')) return {rows:[{acquired:1}]};
      if (sql.startsWith('SELECT * FROM messages')) return {rows:messages.filter(row=>row.requestId===args[1])};
      if (sql.startsWith('SELECT role,content,metadata')) {
        assert.match(sql, /status IN \('saved','completed'\) ORDER BY sequence DESC LIMIT 40$/);
        const eligible = [...priorHistory,...messages].filter(row=>['saved','completed'].includes(row.status));
        return {rows:eligible.slice(-40).reverse().map(row=>({...row,request_id:row.requestId}))};
      }
      if (sql.startsWith('SELECT result FROM hsk_attempts') || sql.startsWith('SELECT value FROM crm_courses')) return {rows:[]};
      if (sql.startsWith('SELECT revision,config FROM enrollment_mail_configuration')) {
        return {rows:[{revision:0,config:{delivery:{mode:'simulation',generation:'fixture'}}}]};
      }
      if (sql.includes(' AS seats') && sql.includes('FROM enrollment_classes e')) {
        return {rows:[{id:classId,state:'published',revision:1,data:classData,opened:1,seats:4}]};
      }
      sqlTrace.push(sql.split(' ').slice(0,3).join(' '));
      if (sql.startsWith('INSERT INTO messages')) {
        const [userId,,requestId,content,assistantId,metadata] = args;
        messages.push({id:userId,requestId,role:'user',content,status:'saved',metadata});
        messages.push({id:assistantId,requestId,role:'assistant',content:'',status:'generating',metadata});
      } else if (sql.startsWith('INSERT INTO ai_attempts')) {
        const [id,model,content,error] = args;
        assert.equal(messages[1].id,id);
        attempts.push({model,content,error});
      } else if (sql.startsWith('UPDATE messages SET content=')) {
        const [id,content,status,model,error,,enrollment,,,prompts,entry] = args;
        assert.equal(messages[1].id,id);
        Object.assign(messages[1],{content,status,model,error,metadata:{...messages[1].metadata,
          enrollment,suggestedPrompts:JSON.parse(prompts),workspaceEntry:JSON.parse(entry)}});
      } else if (!['BEGIN','COMMIT','SELECT RELEASE_LOCK(:p1)'].includes(sql) &&
          !sql.startsWith('UPDATE conversations') && !sql.startsWith("UPDATE messages SET status='interrupted'")) {
        assert.fail('Unexpected SQL: '+sql);
      }
      return {rows:[]};
    },
  };
  globalThis[fixtureKey] = fixture;
  const environment = {
    PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',TRIAL_DATASET:'synthetic',PORTAL_WORKER_ENABLED:'false',
    PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/uper-unused-mailbox-fixture',
    PORTAL_ENROLLMENT_SIMULATION_DATABASE:'uper_trial_fixture',MYSQL_TRIAL_URL:'mysql://fixture.invalid/uper_trial_fixture',
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key=>[key,process.env[key]]));
  Object.assign(process.env,environment);
  t.after(()=>{
    delete globalThis[fixtureKey];
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(globalThis,'fetch',async (url,init) => {
    const target = new URL(url).hostname;
    assert.ok(['primary.invalid','backup.invalid'].includes(target));
    const body = JSON.parse(init.body);
    const instruction = body.messages[0].content;
    const purpose = instruction.startsWith('Identify only the response language.') ? 'language'
      : instruction.startsWith('Extract only the relevant time basis') ? 'schedule' : 'answer';
    calls.push([target,purpose,body.stream]);
    if (purpose === 'answer') fixture.modelHistory=body.messages.slice(1);
    if (purpose === 'language') return response({current:'en',requested:null},body.model);
    if (purpose === 'schedule') return response({basis:'wib',basisEvidence:null},body.model);
    if (target === 'primary.invalid') return sse('incomplete primary answer',false);
    if (bothFail) return new Response('',{status:503});
    if (body.stream) return sse(' ');
    return response(recommendation,'deepseek-v4-pro-version');
  });
  let handle;
  mountChat({post(path,handler){assert.equal(path,'/api/chat');handle=handler;}});
  async function send({stream = true,content = question} = {}) {
    const packets = [];
    let reply, ended = false;
    const headers = new Map();
    const res = {
      setHeader: (name,value) => headers.set(name,value),
      write: packet => packets.push(JSON.parse(packet.trim().slice('data: '.length))),
      json: body => {reply=JSON.parse(JSON.stringify(body));},
      end: () => {ended=true;},
    };
    await handle({body:{content,stream,messageId:'learner-turn',entrySurface:'standalone_chat',lang:'en'}},res);
    return {packets,reply,headers,ended};
  }
  return {fixture,send,messages,attempts,events,logs,calls,sqlTrace,priorHistory};
}

test('Chat publishes only the validated backup reply and preserves class guidance and replay', async t => {
  const {send,messages,attempts,calls,logs,fixture,sqlTrace} = mountFixture(t);
  const {packets,headers,ended} = await send();
  assert.equal(headers.get('Content-Type'),'text/event-stream');
  assert.equal(ended,true);
  assert.deepEqual(packets[0],{saved:true,messageId:'learner-turn'});
  assert.ok(packets.slice(1,-2).every(packet=>packet.reset===true));
  const final = packets.at(-1);
  assert.equal(final.done,true);
  assert.equal(final.status,'completed');
  assert.equal(final.modelUsed,'deepseek-v4-pro');
  assert.match(final.reply,/HSK 1/);
  assert.match(final.reply,/875,000/);
  assert.equal(packets.at(-2).chunk,final.reply);
  assert.deepEqual(final.enrollment.rows.map(row=>row.id),[classId]);
  assert.equal(final.enrollment.replyLanguage,'en');
  const link=enrollmentGuideHref({...final.enrollment,classId},final.enrollment.replyLanguage,'ai_chat',
    new URLSearchParams('p=fixture&email=ignored%40example.test'));
  assert.equal(link,'/enrollment/fixture-weekend?lang=en&enrollment_via=ai_chat&level=1&period=weekend&p=fixture');
  assert.deepEqual(final.suggestedPrompts,['How long is each session?']);
  assert.deepEqual(messages.map(row=>[row.status,row.content]),[['saved',question],['completed',final.reply]]);
  assert.deepEqual(attempts.map(row=>[row.model,row.error,row.content.trim()==='']),[
    ['gpt-6-luna','Missing provider stream end marker',false],
    ['deepseek-v4-pro','Blank provider stream; retrying without streaming',true],
    ['deepseek-v4-pro',undefined,false],
  ]);
  assert.deepEqual(calls,[
    ['primary.invalid','language',true],['primary.invalid','answer',true],
    ['backup.invalid','language',true],['backup.invalid','answer',true],['backup.invalid','answer',false],
    ['backup.invalid','schedule',true],
  ]);
  const recorded = logs.filter(log=>log.event==='chat.token_usage');
  assert.equal(recorded.length,calls.length);
  assert.ok(recorded.every(log=>log.usage.input===50&&log.usage.cached===20&&log.usage.output===15));
  assert.equal(recorded.filter(log=>log.retry).length,1);
  assert.equal(sqlTrace.filter(sql=>sql==='COMMIT').length,2);

  const {reply} = await send({stream:false});
  assert.equal(reply.reply,final.reply);
  assert.deepEqual(reply.enrollment,final.enrollment);
  await assert.rejects(send({stream:false,content:'A different question'}),{status:409,message:'Idempotency key reused with different content'});
  assert.equal(messages.length,2);
  assert.equal(calls.length,6);
  assert.equal(fixture.released,3);
});

test('Chat retains the learner turn and a queryable failure when both providers fail', async t => {
  const {send,messages,attempts,events,fixture} = mountFixture(t,true);
  const {reply} = await send({stream:false});
  assert.equal(reply.saved,true);
  assert.equal(reply.status,'failed');
  assert.equal(reply.error,'all_providers_failed');
  assert.equal(reply.enrollment,undefined);
  assert.deepEqual(messages.map(row=>[row.role,row.status]),[['user','saved'],['assistant','failed']]);
  assert.deepEqual(attempts.map(row=>row.error),['Missing provider stream end marker','Provider HTTP 503']);
  assert.deepEqual(events.map(event=>event.type),['ai.failed']);
  assert.equal(fixture.released,1);
});


test('Chat sends the latest eligible history in its original order', async t => {
  const {fixture,send,priorHistory} = mountFixture(t);
  for(let n=0;n<65;n++)priorHistory.push({
    role:n%2?'assistant':'user',content:'history-'+n,status:n%7===0?'interrupted':n%2?'completed':'saved',
  });
  await send();
  const expected=priorHistory.filter(row=>row.status!=='interrupted').slice(-39).map(({role,content})=>({role,content}));
  assert.deepEqual(fixture.modelHistory.filter(message=>message.content.startsWith('history-')),expected);
});
