import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {assessmentDifferences,assessmentHistory} from '../src/utils/crmAssessmentHistory.ts';
import {CrmAssessmentEvidence} from '../src/components/crm/CrmAssessmentEvidence.tsx';
import {newHskAttempt,gradeHskAttempt} from '../src/data/hskAssessment.ts';
import {getVersionQuestions} from '../src/data/hskAssessmentVersions.ts';
function row(id:string,correct:boolean,mode:'full'|'express'='full'){
 const a=newHskAttempt(mode,'00000000-0000-4000-8000-000000000001');for(const q of getVersionQuestions(mode,a.examVersion,a.scoringVersion))a.answers[q.id]=q.options.find(o=>o.isCorrect===correct)!.id;
 a.completedAt=a.startedAt;return {id,recordedAt:'2026-10-23T12:00:00Z',result:gradeHskAttempt(a,'en')};
}
test('keeps both attempts and flags substantial same-paper difference without mutation',()=>{
 const rows=[row('new',false),row('old',true)];const before=JSON.stringify(rows);assert.equal(assessmentHistory(rows).length,2);assert.deepEqual(assessmentDifferences(rows),[{newerId:'new',olderId:'old',reason:'score',gap:100}]);assert.equal(JSON.stringify(rows),before);assert.equal(rows[0].result.score,0);
});
test('never compares quick raw points with full; excludes incomplete and uncertain evidence',()=>{
 assert.equal(assessmentDifferences([row('new',false,'express'),row('old',true)]).length,0);
 const rows=[row('new',false),row('old',true)];rows[0].result.unansweredCount=1;assert.equal(assessmentDifferences(rows).length,0);
 const quick=[row('new',false,'express'),row('old',true,'express')];quick[0].result.screeningPlacement!.needsReview=true;assert.equal(assessmentDifferences(quick).length,0);
});
test('different versions do not compare scores; close results do not trigger',()=>{
 const rows=[row('new',true),row('old',true)];rows[0].result.score=80;assert.equal(assessmentDifferences(rows).length,0);
 rows[0].result.score=0;rows[0].result.attempt.examVersion='other';assert.equal(assessmentDifferences(rows).length,0);
});
test('deduplicates same attempt, includes a legacy snapshot once, preserves unknown recorded time',()=>{
 const a=row('a',true),b=row('b',false);const all=assessmentHistory([a,a],b.result);assert.equal(all.length,2);assert.equal(all[1].recordedAt,undefined);assert.equal(assessmentHistory(all,b.result).length,2);
});
test('current summary remains latest saved low result, three languages, teacher preserved without new features',()=>{
 const r=row('current',false).result;
 for(const lang of ['en','id','zh'] as const){const html=renderToStaticMarkup(React.createElement(CrmAssessmentEvidence,{lead:{latestAssessment:r,levelSource:'assessment'} as any,lang,timezone:'Asia/Jakarta',summaryOnly:true}));assert.match(html,lang==='zh'?/当前结论/:lang==='id'?/Kesimpulan saat ini/:/Current conclusion/);assert.doesNotMatch(html,/highest score selected|100\/100/);}
 const html=renderToStaticMarkup(React.createElement(CrmAssessmentEvidence,{lead:{latestAssessment:r,levelSource:'trial',levelConfirmed:'HSK 2'} as any,lang:'zh',timezone:'Asia/Jakarta',summaryOnly:true}));assert.match(html,/HSK 2/);assert.doesNotMatch(html,/<input|<select/);
});

test('cross-type caution uses saved conclusions rather than raw points and excludes uncertain quick results',async()=>{
 const {crossTypeConclusionDifference:compare}=await import('../src/utils/crmAssessmentHistory.ts');
 const rows=[row('q',true,'express'),row('f',false,'full')];assert.equal(compare(rows),true);rows[0].result.screeningPlacement!.needsReview=true;assert.equal(compare(rows),false);
});
