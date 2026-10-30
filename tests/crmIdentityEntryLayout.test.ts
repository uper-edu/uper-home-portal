import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CrmLeadWorkspace} from '../src/components/crm/CrmLeadWorkspace';
import {CrmCurrentSalesState} from '../src/components/crm/CrmCurrentSalesState';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {safeStorage} from '../src/utils/safeStorage';
import {crmUiText} from '../src/utils/crmUiText';
const lead:any={id:'TEST-identity-layout',fullName:'TEST Identity Layout',owner:null,currentStage:null,identityReview:{pending:true,canReview:true},attention:{tasks:[]}};
const workspace=(value=lead,view='worklist',extra:any={},lang:any='zh')=>render(React.createElement(CrmUiProvider,{lang,children:React.createElement(CrmLeadWorkspace,{leads:[value],view,lang,isLight:true,timezone:'Asia/Jakarta',employeeId:'identity-layout',employees:[],onOpen(){},onReset(){},onIdentity(){},...extra})}));
const actions=(html:string)=>(html.match(/data-identity-priority="true"/g)||[]).length;
const badges=(html:string)=>(html.match(/data-restriction="identity"/g)||[]).length;
test('main worklist gives each pending lead one status and one actionable review entry',()=>{
 const before=JSON.stringify(lead),html=workspace();assert.equal(actions(html),1);assert.equal(badges(html),1);assert.doesNotMatch(html,/disabled=""[^>]*data-identity-priority|⚠|自己认领|记录进展/);assert.equal(JSON.stringify(lead),before);
});
test('table has one review action whether followup column is visible or hidden',()=>{
 const key='uper_crm_customer_fields_identity-layout';
 try{for(const fields of [['name','followup'],['name','goal']]){safeStorage.setItem(key,JSON.stringify(fields));const html=workspace(lead,'table');assert.equal(actions(html),1);assert.equal(badges(html),1);assert.ok(html.includes('TEST Identity Layout'));}}
 finally{safeStorage.removeItem(key);}
});
test('detail sidebar is status-only even for a reviewer, without an empty stage placeholder',()=>{
 const html=workspace(lead,'worklist',{selectedId:lead.id,children:React.createElement('div',null,'DETAIL')});assert.equal(actions(html),0);assert.equal(badges(html),1);assert.doesNotMatch(html,/crm-current-stage|自己认领|核实后可认领和联系/);assert.ok(html.includes('aria-current="true"'));
});
test('nonreviewers see status and one brief explanation, never a disabled review button',()=>{
 const value={...lead,identityReview:{pending:true,canReview:false}};
 for(const view of ['worklist','table']){const html=workspace(value,view);assert.equal(actions(html),0);assert.equal(badges(html),1);assert.equal((html.match(/核实后可认领和联系/g)||[]).length,1);}
});
test('pending without a stage omits the dash, but actual historical stage and stopped restriction remain',()=>{
 const html=render(React.createElement(CrmCurrentSalesState,{lead,lang:'zh'}));assert.ok(!html.includes('crm-current-stage'));assert.equal(badges(html),1);
 const existing=render(React.createElement(CrmCurrentSalesState,{lead:{...lead,currentStage:'progress:enrolled',contactArrangement:{state:'stopped'}},lang:'zh'}));assert.ok(existing.includes('已报名'));assert.ok(existing.includes('已停止主动联系'));assert.equal(badges(existing),1);
});
test('pending has no new action after review is completed; normal row actions remain available',()=>{
 const value={...lead,currentStage:'progress:discovery',identityReview:{pending:false,canReview:true}};const html=workspace(value,'worklist',{onClaim(){},canClaim:()=>true,progressAction:()=> 'enabled'});assert.equal(actions(html),0);assert.equal(badges(html),0);assert.ok(html.includes('自己认领'));assert.ok(html.includes('记录进展'));
});
test('three-language labels preserve customer names and reviewer availability',()=>{
 for(const lang of ['zh','en','id']){const html=workspace({...lead,identityReview:{pending:true,canReview:false}},'worklist',{},lang);assert.equal(actions(html),0);assert.ok(html.includes(crmUiText('身份待核实',lang)));assert.ok(html.includes(crmUiText('核实后可认领和联系',lang)));assert.ok(html.includes(lead.fullName));}
});
