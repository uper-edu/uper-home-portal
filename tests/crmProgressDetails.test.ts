import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {crmValue} from '../src/utils/crmLanguage';
import {prepareProgressDraft,incompleteAgreement} from '../src/utils/crmProgressDraft';
import {progressDetails,agreementTime} from '../src/utils/crmProgressDetails';
import {CrmSimpleWorkflow} from '../src/components/crm/CrmSimpleWorkflow';
import {CrmSimpleHistory} from '../src/components/crm/CrmSimpleHistory';
import {guideSections} from '../src/components/crm/CrmGuideContent';
const base:any={recordKind:'internal',summary:'TEST original 原文 catatan',channel:'WhatsApp',connectStatus:'Connected',expectedStage:'New',answeredRequests:['request']};
test('hidden agreement drafts do not submit stale changes; internal facts never claim replies',()=>{
 const b=prepareProgressDraft({...base,agreementIntent:'',commitmentChange:{id:'old',status:'fulfilled'},commitmentAction:'HIDDEN',commitmentLocal:'2099-01-02T10:00',newStage:''},'Asia/Jakarta');
 assert.equal(b.commitment,undefined);assert.equal(b.commitmentChange,undefined);assert.equal(b.answeredRequests,undefined);assert.equal(b.connectStatus,undefined);assert.equal(b.newStage,undefined);assert.equal(b.commitmentLocal,undefined);
});
test('date precision is an explicit exclusive choice, with no invented time; reschedule requires a replacement',()=>{
 const d={...base,agreementIntent:'new',commitmentAction:'TEST actual agreement'};
 assert.equal(incompleteAgreement(d),false);assert.equal(prepareProgressDraft(d,'Asia/Jakarta').commitment?.at,undefined);
 const date=prepareProgressDraft({...d,agreementTiming:'date',commitmentDate:'2099-01-02',commitmentLocal:'2099-01-02T12:00'},'Asia/Jakarta').commitment;assert.equal(date.date,'2099-01-02');assert.equal(date.at,undefined);
 const exact=prepareProgressDraft({...d,agreementTiming:'exact',commitmentDate:'2099-01-02',commitmentLocal:'2099-01-02T10:30'},'Asia/Jakarta').commitment;assert.equal(exact.at,'2099-01-02T03:30:00.000Z');assert.equal(exact.date,undefined);
 assert.equal(incompleteAgreement({...d,agreementTiming:'date'}),true);
 assert.equal(incompleteAgreement({...base,agreementIntent:'update',commitmentChange:{id:'old',status:'',reason:'TEST'}}),true);
 assert.equal(incompleteAgreement({...base,agreementIntent:'update',commitmentChange:{id:'old',status:'rescheduled',reason:'TEST'}}),true);
 assert.equal(incompleteAgreement({...base,agreementIntent:'update',commitmentChange:{id:'old',status:'cancelled',reason:'TEST'}}),false);
});
test('full history preserves all recorded changes, reasons and actual replies, never current state as historical facts',()=>{
 const log:any={...base,recordKind:'contact',staffName:'TEST Operator',at:'2099-01-01T00:00:00Z',newStage:'Contacted',buyingSignalsDetected:['Asked price'],contactState:'stopped',contactReason:'ORIGINAL restriction',exceptionReason:'ORIGINAL exception',commitment:{action:'ORIGINAL new',date:'2099-01-02',timezone:'Asia/Jakarta'},commitmentChange:{id:'old',status:'rescheduled',reason:'ORIGINAL reason'},result:{handledRequestIds:['request'],completedTaskIds:['first'],firstOutcome:'connected'}};
 const lead={currentStage:'Enrolled',followUpLogs:[log],commitments:[{id:'old',action:'ORIGINAL old',date:'2099-01-01'}]};const requests=[{id:'request',data:{text:'ORIGINAL customer request'}}];
 for(const lang of ['en','id','zh'] as const){const before=JSON.stringify({log,lead,requests});const values=progressDetails(log,lead,requests,lang,'Asia/Jakarta').map(r=>r.value).join('\n');for(const v of ['ORIGINAL restriction','ORIGINAL exception','ORIGINAL new','ORIGINAL old','ORIGINAL reason','ORIGINAL customer request'])assert.ok(values.includes(v));assert.ok(values.includes(' → '));const html=renderToStaticMarkup(React.createElement(CrmSimpleHistory,{lead,requests,lang,timezone:'Asia/Jakarta'}));assert.ok(html.includes('TEST original 原文 catatan'));assert.ok(html.includes('TEST Operator'));assert.ok(html.includes('ORIGINAL reason'));assert.equal(JSON.stringify({log,lead,requests}),before);}
 assert.match(agreementTime({date:'2099-01-02'},'Asia/Jakarta','en'),/Date only/);
});
test('three-language default form has a short fact path, separate optional sections, no prefilled success or agreement controls',()=>{
 for(const lang of ['en','id','zh']){const html=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{lead:{id:'TEST',currentStage:'New'},employee:{id:'TEST'},lang,isLight:true,timezone:'Asia/Jakarta'}));assert.equal((html.match(/<textarea[^>]*required=""[^>]*aria-label=/g)||[]).length,1);assert.equal((html.match(/type="date"/g)||[]).length,0);assert.equal((html.match(/type="datetime-local"/g)||[]).length,0);assert.ok(html.includes('disabled=""'));assert.ok(!html.includes('undefined'));}
});

test('contact results describe both calls and messages without renaming canonical values',()=>{assert.equal(crmValue('Connected','zh'),'已接通／已回复');assert.equal(crmValue('No Response','zh'),'未接通／未回复');assert.equal(crmValue('Wrong Number','zh'),'联系方式无效');assert.equal(crmValue('No Response','id'),'Tidak tersambung / belum dibalas');});
