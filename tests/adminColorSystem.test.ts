import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {builtInRoles} from '../src/utils/accessControl';
import {progressActionState} from '../src/utils/crmProgressAction';
import {CrmProgressAction} from '../src/components/crm/CrmProgressAction';
import {CrmSaveFeedback} from '../src/components/crm/CrmDetailWorkspace';
import {AdminStatus} from '../src/components/AdminStatus';
const css=fs.readFileSync('src/components/admin-colors.css','utf8');
const palettes=[...css.matchAll(/(?:\:root,\[data-theme=light\]|\[data-theme=dark\])\{([^}]+)\}/g)].map(m=>Object.fromEntries([...m[1].matchAll(/--admin-([\w-]+):\s*(#[\da-f]{6})/g)].map(v=>[v[1],v[2]])));
function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [index,p] of palettes.entries())test(`${index?'dark':'light'} semantic text, surfaces, action foreground and focus contrast`,()=>{
 assert.equal(palettes.length,2);
 const pairs=[['text','surface'],['muted','surface'],['action','surface'],['action','selected'],['on-action','action-fill'],['registration','surface'],['ai','ai-bg'],['quote','quote-bg'],...['success','info','warning','danger'].flatMap(s=>[[s,'surface'],[s,`${s}-bg`]])];
 for(const [fg,bg] of pairs)assert.ok(contrast(p[fg],p[bg])>=4.5,`${fg}/${bg}=${contrast(p[fg],p[bg])}`);
 for(const fg of ['focus','success-border','info-border','warning-border','danger-border'])assert.ok(contrast(p[fg],p.surface)>=3,fg);
});
const employee=(role:string)=>({id:'A',active:true,roles:[role],scope:'own',permissions:Object.keys(builtInRoles[role].grants),grants:Object.fromEntries(Object.entries(builtInRoles[role].grants).map(([k,v])=>[k,[v]]))});
test('real-role action matrix hides denied scope, explains an attainable claim, and does not require managers to claim',()=>{
 const sales=employee('sales'),manager=employee('crm_leader');
 assert.equal(progressActionState(sales,{owner:'A'}),'enabled');
 assert.equal(progressActionState(sales,{owner:null}),'claim');
 assert.equal(progressActionState(sales,{owner:'B'}),'hidden');
 assert.equal(progressActionState(sales,{owner:null,identityReview:{pending:true}}),'hidden');
 assert.equal(progressActionState(manager,{owner:null}),'enabled');
 assert.equal(progressActionState(manager,{owner:'B'}),'enabled');
 for(const e of [employee('cms_admin'),{...sales,active:false},{...sales,permissions:['crm.read']},{...sales,grants:{'crm.followup':['team'],'crm.claim':[]}}])assert.equal(progressActionState(e,{owner:'B'}),'hidden');
 assert.equal(progressActionState({...sales,grants:{'crm.followup':['own'],'crm.read':['own'],'crm.claim':[]}},{owner:null}),'hidden');
});
test('progress control omits inaccessible action, visibly explains claim, retains busy feedback and keyboard semantics',()=>{
 const markup=(state:any,busy=false)=>render(React.createElement(CrmProgressAction,{state,busy,lang:'zh',onClick(){}}));
 assert.equal(markup('hidden'),'');
 assert.match(markup('claim'),/disabled=""/);assert.match(markup('claim'),/aria-describedby=/);assert.match(markup('claim'),/请先自己认领/);
 assert.doesNotMatch(markup('enabled'),/disabled|请先自己认领/);
 assert.match(markup('enabled',true),/保存中…/);assert.match(markup('enabled',true),/disabled=""/);
});
test('save unknown remains an alert and query-before-retry, uses warning independently from explicit failure',()=>{
 const unknown=render(React.createElement(CrmSaveFeedback,{state:'unknown',lang:'zh'})),error=render(React.createElement(CrmSaveFeedback,{state:'error',lang:'zh'}));
 assert.match(unknown,/role="alert"/);assert.match(unknown,/data-state="unknown"/);assert.notEqual(unknown,error);
 const styles=fs.readFileSync('src/components/crm/crm-detail-workspace.css','utf8');
 assert.match(styles,/\[data-state=unknown\]\{color:var\(--admin-warning\)/);assert.match(styles,/\[data-state=error\]\{color:var\(--admin-danger\)/);
});
test('CMS status always has a visible business label, decorative dot is hidden from assistive tech',()=>{
 const active=render(React.createElement(AdminStatus,{active:true},'在线')),hidden=render(React.createElement(AdminStatus,{active:false},'隐藏'));
 assert.match(active,/data-tone="success"/);assert.match(active,/aria-hidden="true"/);assert.match(active,/在线/);assert.match(hidden,/data-tone="neutral"/);assert.doesNotMatch(hidden,/admin-status-dot/);
});
