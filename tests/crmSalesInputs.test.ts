import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { completionForEntry } from "../src/utils/crmSalesInput.ts";
import { CrmWorkflowForm } from "../src/components/crm/CrmWorkflowForm.tsx";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
test("Sales editor cannot restore other tasks from a stale draft", () => {
  assert.deepEqual(completionForEntry("a", ["b", "a", "c"]), ["a"]);
  assert.deepEqual(completionForEntry(undefined, ["a"]), []);
  assert.deepEqual(completionForEntry("a", []), []);
});
test("Explicit task entry rejects widening or completing from an ordinary record", () => {
  const body = {
    requestId: "test",
    summary: "Original",
    channel: "WhatsApp",
    connectStatus: "Connected",
    disposition: "record_only",
    completeTaskIds: [],
  };
  assert.doesNotThrow(() =>
    validateWorkflow({ ...body, processingTaskId: null }),
  );
  assert.doesNotThrow(() =>
    validateWorkflow({
      ...body,
      disposition: "keep",
      processingTaskId: "a",
      taskOutcome: "complete",
      completeTaskIds: ["a"],
    }),
  );
  for (const extra of [
    { processingTaskId: null, completeTaskIds: ["a"] },
    { processingTaskId: "a", completeTaskIds: ["b"] },
    { processingTaskId: "a", completeTaskIds: ["a", "b"] },
  ])
    assert.throws(
      () => validateWorkflow({ ...body, ...extra, disposition: "keep" }),
      /Invalid task selection/,
    );
});
const lead={id:'TEST-entry',owner:'Robert',currentStage:'Contacted',attention:{tasks:[{id:'a',kind:'follow_up',status:'open',revision:0,due_at:'2099-10-01T02:00:00Z',details:{action:'Bound task'}},{id:'b',kind:'follow_up',status:'open',due_at:'2099-10-02T02:00:00Z',details:{action:'Unrelated task'}}]}};
const render=(props:any)=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead,employee:{id:'Robert'},lang:'zh',timezone:'Asia/Jakarta',selectedTask:'a',...props}));
test("progress in all languages is separate from closure and planning; contact is an explicit fact",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));for(const l of ['en','id','zh']){const h=render(l,{initialDraft:{simple:{recordKind:'contact',summary:'',channel:'',connectStatus:''}}});assert.match(h,/Select the actual result|Pilih hasil nyata|选择实际结果/);assert.doesNotMatch(h,/Bound task|Unrelated task/);assert.doesNotMatch(h,/do not have to create a next task|Tidak wajib tugas berikutnya|无需创建下一任务/);}});
test("contact-only form omits internal exception flow without forcing a future task",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));for(const l of ['en','id','zh']){const h=render(l,{administrative:true});assert.doesNotMatch(h,/name="taskOutcome"/);assert.doesNotMatch(h,/Exception|exception|Pengecualian|例外/);assert.doesNotMatch(h,/Contacted the customer this time|Menghubungi pelanggan kali ini|本次有联系客户/);assert.match(h,/Contact channel|Saluran kontak|联系渠道/);}});
test("legacy signal selections stay visible as a warning and unrelated drafts are not applied",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));const h=render('zh',{initialDraft:{simple:{recordKind:'internal',summary:'Fact',buyingSignalsDetected:['Asked price','Asked payment']}}});assert.doesNotMatch(h,/本次观察到的购买信号（可多选）/);assert.match(h,/旧草稿中的阶段／信号勾选不再提交/);assert.match(h,/Fact/);assert.doesNotMatch(render('zh',{initialDraft:{operation:'close',selectedTask:'b',summary:'Wrong draft'}}),/Wrong draft/);});
test("contact-arrangement form remains a separate controlled operation",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));const h=render('zh',{administrative:true});assert.match(h,/主动联系安排/);assert.match(h,/保持现有安排/);assert.doesNotMatch(h,/复查依据（必填）|调整原因（必填）/);});
