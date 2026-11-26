import assert from 'node:assert/strict';
import test from 'node:test';
import {readTeacherSettlements,saveTeacherSettlement,teacherSettlementTargets} from '../server/portal/operationsDashboardTeacherSettlements.ts';
import {summarizeTeacherSettlements,teacherSettlementCost,type TeacherSettlementDraft} from '../src/utils/crmTeacherSettlements.ts';
import {dashboardScopes} from '../src/utils/crmOperationsDashboard.ts';

const ordinary={kind:'class',referenceId:'mock-class',lessons:2,lessonFee:180_000} as const;
const appointment={kind:'appointment',referenceId:'mock-booking',lessons:1,lessonFee:180_000} as const;
const input:TeacherSettlementDraft={number:'mock/001',month:'2026-11',reason:'',revision:null,lines:[ordinary,appointment]};
const now=Date.parse('2026-11-25T03:00:00Z');

function harness(){
  const stored=new Map<string,unknown>();
  const audit:unknown[][]=[];
  let tail:Promise<unknown>=Promise.resolve(),failAudit=false;
  const db={async query(sql:string,args:unknown[]){
    const key=String(args[0]),result=(rows:unknown[]=[])=>({rows:structuredClone(rows)});
    if(sql.includes('FROM enrollment_classes')||sql.includes('FROM enrollment_demands')){
      const group=sql.includes('FROM enrollment_classes'),line=group?ordinary:appointment;
      if(!group)assert.match(sql,/JSON_TYPE\(criteria->'\$\.appointment.confirmation'\)='OBJECT'/);
      if(key==='unassigned')return result([{id:key,level:'HSK 1',format:'standard',teacher:''}]);
      return result(!key||line.referenceId.includes(key)?[{id:line.referenceId,teacher:group?'模拟教师甲':'模拟教师乙',level:'HSK 1',
        format:group?'standard':'one-on-one',period:group?'weekend':null,minutes:45}]:[]);
    }
    if(sql.includes(' WHERE id LIKE ')){
      const prefix=key.replaceAll('=_','_').slice(0,-1);
      return result([...stored].filter(([id])=>id.startsWith(prefix)).map(([,value])=>({value})));
    }
    if(sql.includes('SELECT value'))return result(stored.has(key)?[{value:stored.get(key)}]:[]);
    if(sql.includes('DELETE FROM portal_settings'))stored.delete(key);
    else if(sql.includes('ON DUPLICATE KEY UPDATE id=id')){
      if(!stored.has(key))stored.set(key,structuredClone(args[1]));
    }else if(sql.includes('INSERT INTO portal_settings')||sql.includes('UPDATE portal_settings'))stored.set(key,structuredClone(args[1]));
    else if(sql.includes('INSERT INTO portal_audit')){
      if(failAudit)throw Error('audit unavailable');
      audit.push(args);
    }else throw Error('Unexpected SQL '+sql);
    return result();
  }};
  function save(body:unknown,environment:'dev'|'test'='dev'){
    const write=tail.then(async()=>{
      const before=structuredClone(stored);
      try{return await saveTeacherSettlement(db,environment,body,'mock-finance',now);}
      catch(error){
        stored.clear();
        for(const [key,value] of before)stored.set(key,value);
        throw error;
      }
    });
    tail=write.catch(()=>{});
    return write;
  }
  const report=(month='2026-11',env:'dev'|'test'='dev')=>readTeacherSettlements(db,env,month);
  return {db,save,report,stored,audit,failAudit:()=>{failAudit=true;}};
}

test('each class uses the CRM instructor and one 45-minute lesson counts as one billable unit',async()=>{
  const {save,report}=harness();
  const record=await save({...input,lines:[{...ordinary,teacher:'不使用请求传入的教师'},appointment]});
  assert.deepEqual(record.lines.map(line=>line.target.teacher),['模拟教师甲','模拟教师乙']);
  assert.deepEqual(record.lines.map(line=>line.target.minutes),[45,45]);
  assert.deepEqual(summarizeTeacherSettlements((await report()).records),{IDR:540_000,class:360_000,appointment:180_000,lessons:3,pending:0});
  assert.equal(teacherSettlementCost(2,100_001),200_002);
});

test('settlement replay deduplicates normalized numbers and rejects duplicate classes inside the statement',async()=>{
  const {save,report,audit}=harness();
  const [first,replay]=await Promise.all([save(input),save({...input,number:' MOCK/001 '})]);
  assert.equal(first.revision,replay.revision);
  await assert.rejects(save({...input,month:'2026-12'}),{message:'teacher_settlement_duplicate',status:409});
  await assert.rejects(save({...input,lines:[ordinary,{...ordinary,lessons:3}]}),{message:'teacher_settlement_lines_duplicate'});
  assert.equal((await report()).records.length,1);
  assert.equal(audit.length,1);
});

test('different statement numbers and months cannot both settle the same historical class',async()=>{
  const {save,report,audit}=harness();
  const first=await save({...input,lines:[ordinary]});
  await assert.rejects(save({...input,number:'MOCK/002',month:'2026-12',lines:[ordinary]}),
    {message:'teacher_settlement_already_recorded',status:409,number:first.number,month:first.month});
  assert.equal((await report('2026-12')).records.length,0);
  assert.equal(audit.length,1);
});

test('correction moves the payable between periods, preserves history and rejects stale revision',async()=>{
  const {save,report,stored,audit}=harness();
  const original=await save(input);
  const correction={...input,month:'2026-12',revision:original.revision,reason:'财务更正',
    lines:[{...ordinary,lessonFee:225_000}]};
  await assert.rejects(save({...correction,reason:''}),{message:'teacher_settlement_reason'});
  const updated=await save(correction);
  assert.equal((await save(correction)).revision,updated.revision);
  await assert.rejects(save({...correction,lines:[ordinary]}),{message:'teacher_settlement_conflict',status:409});
  assert.equal((await report()).records.length,0);
  assert.equal(summarizeTeacherSettlements((await report('2026-12')).records).IDR,450_000);
  assert.equal(summarizeTeacherSettlements((await report('2026-12','test')).records).IDR,0);
  const history=[...stored.entries()].find(([key])=>key.endsWith(updated.revision))?.[1];
  assert.deepEqual(history,{actorId:'mock-finance',before:original,after:updated});
  assert.equal(audit.length,2);
  await save({...input,number:'MOCK/002',lines:[appointment]});
  assert.equal((await report()).records.length,1);
});

test('invalid lesson counts, fees, periods and unconfirmed bookings never enter the ledger',async()=>{
  const {save,report,db,stored}=harness();
  for(const bad of [{month:'2026-13'},{lines:[{...ordinary,lessonFee:0}]},{lines:[{...ordinary,lessonFee:1.5}]},
    {lines:[{...ordinary,lessonFee:undefined,hourlyRate:180_000,minutes:90}]},{lines:[{...ordinary,lessons:0}]}]){
    await assert.rejects(save({...input,...bad}),{message:'teacher_settlement_invalid'});
  }
  await assert.rejects(save({...input,lines:[{...appointment,referenceId:'pending-booking'}]}),{message:'teacher_settlement_target'});
  await assert.rejects(save({...input,lines:[{...ordinary,referenceId:'unassigned'}]}),{message:'teacher_settlement_teacher_missing'});
  assert.equal((await teacherSettlementTargets(db,'appointment','pending')).length,0);
  assert.equal((await report()).records.length,0);
  assert.equal(stored.size,0);
});

test('an audit write failure rolls back both the statement and the month index',async()=>{
  const {save,report,failAudit,stored}=harness();
  failAudit();
  await assert.rejects(save(input),{message:'audit unavailable'});
  assert.equal((await report()).records.length,0);
  assert.equal(stored.size,0);
});

test('teacher settlement finance access requires all-record CRM and payment verification access',()=>{
  const staff={id:'finance',scope:'all' as const,permissions:['crm.read','crm.payments.verify']};
  assert.equal(dashboardScopes(staff).finance,true);
  assert.equal(dashboardScopes({...staff,permissions:['crm.read','crm.operations.manage']}).finance,false);
  assert.equal(dashboardScopes({...staff,scope:'own'}).finance,false);
});
