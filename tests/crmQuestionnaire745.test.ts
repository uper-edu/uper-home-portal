import test from'node:test';import assert from'node:assert/strict';import{appendRecordAmendment}from'../server/portal/recordAmendments';
test('745 direct questionnaire amendments fail without writes, AI or notification work',async()=>{
 const writes:string[]=[];const db={query:async(sql:string)=>{if(!sql.startsWith('SELECT'))writes.push(sql);if(sql.startsWith('SELECT profile'))return{rows:[{profile:{id:'A'}}]};if(sql.startsWith('SELECT * FROM crm_facts'))return{rows:[{id:'q',kind:'questionnaire.submitted',data:{answers:{city:'Jakarta'}}}]};return{rows:[]};}};
 await assert.rejects(appendRecordAmendment(db,'A','manager',{requestId:'test745',targetFactId:'q',kind:'supplement',text:'new fact'},()=>true),/客户问卷原文只读/);assert.deepEqual(writes,[]);
});
