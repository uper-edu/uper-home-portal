import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveSalesRecords} from '../src/utils/crmRecordAmendments';
import {reviewedProgressAgreements} from '../src/utils/crmProgressRecord';
test('744 correction round trips restore original direction, not an intermediate derived direction',()=>{
 for(const direction of ['customer','sales','unknown'])for(const intermediate of ['Not Occurred','No Response','Duplicate']){
 const original={id:'a',contactDirection:direction,connectStatus:'Connected',occurredAt:'2026-10-29T10:00:00Z'};
 const lead={followUpLogs:[original],recordAmendments:[{targetLogId:'a',kind:'correction',contactResult:intermediate},{targetLogId:'a',kind:'correction',contactResult:'Connected'}]};
 const [result]=effectiveSalesRecords(lead);assert.equal(result.contactDirection,direction);assert.equal(result.contactExcluded,false);assert.equal(result.occurredAt,original.occurredAt);assert.equal(original.contactDirection,direction);
 }
});
test('746 stale agreement selection is cleared without redirecting instruction to replacement',()=>{
 const draft={summary:'取消周六',commitmentChange:{id:'old',status:'cancelled'}};
 const latest={commitments:[{id:'old',status:'rescheduled'},{id:'new',status:'active'}]};
 const reviewed=reviewedProgressAgreements(draft,latest);assert.equal(reviewed.invalidated,true);assert.equal({...draft,...reviewed.patch}.summary,draft.summary);assert.equal({...draft,...reviewed.patch}.commitmentChange,undefined);assert.equal(draft.commitmentChange.id,'old');
 assert.equal(reviewedProgressAgreements(draft,{commitments:[{id:'old',status:'active'}]}).invalidated,false);
 assert.equal(reviewedProgressAgreements(draft,{commitments:[]}).invalidated,true);
});
