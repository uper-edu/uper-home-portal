import {crmId} from '../src/utils/crmIndonesian';
import {CrmInteractionTimelines} from '../src/components/crm/CrmInteractionTimelines';
import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';import fs from 'node:fs';import ts from 'typescript';
import {CrmUiProvider,crmUiText} from '../src/components/crm/CrmUiLanguage';
import {CrmLeadWorkspace} from '../src/components/crm/CrmLeadWorkspace';
import {CrmStageEditor} from '../src/components/crm/CrmTrustPanel';
import {CrmHistoryInformation} from '../src/components/crm/CrmHistoryInformation';
import {CrmExtractionRows} from '../src/components/crm/CrmExtractedInformation';
import {CrmSalesStageChange} from '../src/components/crm/CrmSalesStage';
import {FactMilestoneRows} from '../src/components/crm/CrmFactMilestones';
import {historyBusinessTitle,historyPreview} from '../src/utils/crmHistoryTimeline';
import {listLearningNeeds,budgetPresentation} from '../src/utils/crmLeadPresentation';
import {salesProgressStages,progressDefinition} from '../src/utils/crmSalesProgress';
const dictionary=JSON.parse(fs.readFileSync('src/utils/crm-ui-presentation.json','utf8'));
const view=(lang:any,node:any)=>render(React.createElement(CrmUiProvider,{lang,children:node}));
const plain=(s:string)=>s.replace(/<[^>]*>/g,' ');
const lead:any={id:'maya',fullName:'Maya Putri',tier:'Hot',owner:'Robert',goal:'Work in China',mode:'Online',availability:'Saturday evening',preferredStart:'Next month',budgetAmount:1800000,concerns:'Work travel',currentStage:'progress:proposal',reportedLevel:'Not sure',interactionTimeline:{communication:null,customer:null,sales:{at:'2026-10-27T01:00:00Z',channel:'WhatsApp',result:'No Response',source:'contact'}},factMilestoneSummary:[{key:'assessment:full',count:2,unknownCount:1,latest:{occurredAt:'2026-10-27T01:00:00Z'}}],commitments:[{id:'agree',status:'active',action:'Confirm the Saturday class',date:'2026-10-30'}],attention:{tasks:[]}};
for(const lang of ['zh','en','id'] as const){
 test(`${lang}: compact needs use concise labels without abbreviating full form labels or changing values`,()=>{
 const rows=listLearningNeeds(lead,lang);assert.deepEqual(rows.map(r=>r.label),lang==='zh'?['上课时段','计划开始','课程总预算','顾虑']:lang==='en'?['Availability','Start','Budget','Concerns']:['Jadwal','Mulai','Anggaran','Kendala']);
 assert.equal(budgetPresentation(lead,lang)?.label,lang==='zh'?'课程总预算':lang==='en'?'Total course budget':'Anggaran total kursus');assert.ok(rows.some(r=>r.value==='Saturday evening'));
 });
 test(`${lang}: rich lead list localises fixed text and accessibility labels while preserving names and originals`,()=>{
 const before=JSON.stringify(lead),html=view(lang,React.createElement(CrmLeadWorkspace,{leads:[lead],view:'worklist',lang,isLight:true,timezone:'Asia/Jakarta',employeeId:'Robert',employees:[],onOpen(){},onReset(){}}));
 assert.match(html,/Maya Putri/);assert.match(html,/Confirm the Saturday class/);assert.equal(JSON.stringify(lead),before);
 if(lang!=='zh')assert.doesNotMatch(html,/[\u4e00-\u9fff]/);
 });
 test(`${lang}: both stage names and definitions are translated, current marker and radios retained`,()=>{
 const html=view(lang,React.createElement(CrmStageEditor,{lead,lang,isLight:true,inDrawer:true,onSaved(){}}));
 assert.equal((html.match(/type="radio"/g)||[]).length,7);
 if(lang!=='zh')assert.doesNotMatch(html,/[\u4e00-\u9fff]/);
 for(const stage of salesProgressStages){assert.ok(progressDefinition(stage[0],lang));if(lang!=='zh')assert.doesNotMatch(progressDefinition(stage[0],lang),/[\u4e00-\u9fff]/);}
 });
 test(`${lang}: milestone rows and nested stage changes inherit the UI language`,()=>{
 const html=view(lang,React.createElement(React.Fragment,null,React.createElement(FactMilestoneRows,{groups:[{key:'assessment:full',title:'完成完整测评',count:2,unknownCount:1,latest:{occurredAt:'2026-10-27T01:00:00Z'}}],onOpen(){}}),React.createElement(CrmSalesStageChange,{before:'progress:discovery',after:'progress:proposal'})));
 if(lang!=='zh')assert.doesNotMatch(html,/[\u4e00-\u9fff]/);
 });
 test(`${lang}: historical results translate system status, retain customer wording and real reasons`,()=>{
 const original='客户只说周六晚上可以上课',reason='销售原始原因不得改写',group={id:'log:a',category:'sales',events:[],extractions:[{id:'e',source_type:'sales_record',source_id:'a',status:'completed',input:{text:original},output:{observations:[{kind:'field',field:'availability',value:original,decision:'difference',quote:original,reason,subject:'customer',temporality:'current'}]}}],original};
 const html=view(lang,React.createElement(CrmHistoryInformation,{group}));assert.match(html,new RegExp(original));assert.match(html,new RegExp(reason));
 if(lang!=='zh')assert.doesNotMatch(plain(html).replaceAll(original,'').replaceAll(reason,''),/[\u4e00-\u9fff]/);
 const state=view(lang,React.createElement(CrmExtractionRows,{rows:['pending','processing','retry','failed'].map(status=>({id:status,status,source_type:'sales_record',input:{}})),embedded:true,includeSource:false}));if(lang!=='zh')assert.doesNotMatch(plain(state),/[\u4e00-\u9fff]/);
 });
 test(`${lang}: business history titles and questionnaire previews localise framing, not saved originals`,()=>{
 const owner:any={root:{eventType:'owner.changed',payload:{beforeName:'Wigar',afterName:'Robert'}},category:'ownership',events:[],original:''};const profile:any={root:{eventType:'profile.fields_updated',payload:{}},category:'profile',events:[{payload:{changes:[{field:'city',before:'Jakarta',after:'Bandung'}]}}],original:''};
 for(const g of [owner,profile]){const before=JSON.stringify(g);const label=historyBusinessTitle(g,lang);if(lang!=='zh')assert.doesNotMatch(label,/[\u4e00-\u9fff]/);assert.equal(JSON.stringify(g),before);}
 const q:any={category:'questionnaire',root:{eventType:'questionnaire.submitted',payload:{answers:{city:'Jakarta',goal:'Work in China',mode:'Online'}}}};if(lang!=='zh')assert.doesNotMatch(historyPreview(q,lang),/[\u4e00-\u9fff]/);
 });
}
test('all fixed ui() literals in CRM have English and Indonesian entries; originals are never used as translation input by this check',()=>{
 const missing:string[]=[];
 for(const file of fs.readdirSync('src/components/crm').filter(f=>f.endsWith('.tsx'))){const code=fs.readFileSync('src/components/crm/'+file,'utf8'),ast=ts.createSourceFile(file,code,99,true,ts.ScriptKind.TSX);function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='ui'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const key=n.arguments[0].text;if(/[\u4e00-\u9fff]/.test(key)&&(!dictionary[key]?.[0]?.trim()||!dictionary[key]?.[1]?.trim()))missing.push(file+': '+key);}ts.forEachChild(n,visit);}visit(ast);}
 assert.deepEqual(missing,[]);
 for(const [key,translations]of Object.entries(dictionary)as [string,string[]][]){assert.equal(translations.length,2,key);assert.ok(translations.every(x=>typeof x==='string'&&x.trim()),key);assert.ok(translations.every(x=>!/[\u4e00-\u9fff]/.test(x)),key+' must not fall back to Chinese');}
});

for(const lang of ['zh','en','id']as const)test(lang+': list and follow-up share exactly the same three interaction headings and record labels',()=>{
 const renderTrack=(summary:boolean)=>view(lang,React.createElement(CrmInteractionTimelines,{lead,lang,summaryMode:summary,compact:!summary,isLight:true}));
 const list=renderTrack(false),detail=renderTrack(true);
 const labels=(html:string)=>[...html.matchAll(/class="crm-interaction-label">([^<]+)</g)].map(m=>m[1]);
 assert.deepEqual(labels(list),labels(detail));assert.deepEqual(labels(list),lang==='zh'?['有效沟通','客户互动','销售联系']:lang==='en'?['Conversation','Customer interactions','Sales outreach']:['Komunikasi','Interaksi pelanggan','Kontak sales']);
});

test('two-language CRM label callers have Indonesian coverage; only deliberate shared terms may remain identical',()=>{
 const shared=new Set(['Email','total','Status:','Jakarta (UTC+7)','Makassar (UTC+8)','Shanghai (UTC+8)']);const missing:string[]=[];
 for(const file of [...fs.readdirSync('src/components/crm').filter(f=>f.endsWith('.tsx')).map(f=>'src/components/crm/'+f),'src/pages/CrmWorkbench.tsx']){
  const code=fs.readFileSync(file,'utf8');if(!code.includes('crmId'))continue;const ast=ts.createSourceFile(file,code,99,true,ts.ScriptKind.TSX);
  function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'&&n.arguments.length===2&&ts.isStringLiteral(n.arguments[0])){const en=n.arguments[0].text;if(/[a-zA-Z]{3}/.test(en)&&crmId(en)===en&&!shared.has(en))missing.push(file+': '+en);}ts.forEachChild(n,visit);}visit(ast);
 }
 assert.deepEqual(missing,[]);
});
