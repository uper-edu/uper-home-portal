import test from 'node:test';
import assert from 'node:assert/strict';
import {historyProgressDetails,progressDetails} from '../src/utils/crmProgressDetails';
const log={channel:'Phone',contactDirection:'sales',connectStatus:'Connected',result:{completedTaskIds:['first'],firstOutcome:'connected'}};
test('history reports contact outcome once and keeps independent proven first-requirement completion',()=>{
 const before=JSON.stringify(log),rows=historyProgressDetails(log,{},[],'Asia/Jakarta');
 assert.equal(rows.filter(r=>/已接通|已回复/.test(r.value)).length,1);
 assert.deepEqual(rows.find(r=>r.label==='首次联系要求'),{label:'首次联系要求',value:'当次已完成'});
 assert.equal(JSON.stringify(log),before);assert.ok(progressDetails(log,{},[],'zh','Asia/Jakarta').some(r=>r.label==='首次跟进处理结果'));
});
test('no first-requirement completion is inferred from connected or no-response contact alone',()=>{
 for(const connectStatus of ['Connected','No Response','Wrong Number']){
  const rows=historyProgressDetails({...log,connectStatus,result:{firstOutcome:'connected'}},{},[],'Asia/Jakarta');
  assert.ok(rows.some(r=>r.label==='实际联系结果'));assert.ok(!rows.some(r=>r.label==='首次联系要求'));
 }
});
test('unanswered attempts and exceptional completion retain independent handling without repeating the contact outcome',()=>{
 const rows=historyProgressDetails({...log,connectStatus:'No Response',exceptionReason:'约定由客户再次联系',result:{completedTaskIds:['first'],firstOutcome:'attempted'}},{},[],'Asia/Jakarta');
 assert.equal(rows.filter(r=>r.label==='实际联系结果').length,1);assert.equal(rows.find(r=>r.label==='首次联系要求')?.value,'当次已完成');assert.ok(rows.some(r=>r.value==='约定由客户再次联系'));
});
