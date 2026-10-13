import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { newHskAttempt, gradeHskAttempt } from '../src/data/hskAssessment';
import { getVersionQuestions } from '../src/data/hskAssessmentVersions';
import { learnerScreeningGuidance, learnerAssessmentGuidance } from '../src/data/hskLearnerGuidance';
import { hskWhatsAppDraft } from '../src/services/hskWhatsApp';
import { consultationFocus, consultationProfile } from '../server/portal/consultationGuidance';
import HskAssessmentReport from '../src/components/HskAssessmentReport';
import HSKPlacementAssessment from '../src/components/HSKPlacementAssessment';
import { getChatAssessmentStatus } from '../src/services/studentProfileStorage';

function sample(counts:number[]=[5,5,5],mode:'express'|'full'='express'){
  const attempt=newHskAttempt(mode,randomUUID());attempt.completedAt=new Date().toISOString();
  for(const [i,level] of ['HSK 1','HSK 2','HSK 3'].entries())getVersionQuestions(mode).filter(q=>q.level===level).forEach((q,n)=>{attempt.answers[q.id]=q.options.find(o=>o.isCorrect===(n<counts[i]))!.id;});
  return attempt;
}
test('14/15 stable start hides irrelevant unanswered warning without modifying grading or history',()=>{
  const a=sample();a.answers[14]=null;
  const result={...gradeHskAttempt(a),saveStatus:'saved' as const};
  const original=JSON.stringify(result);
  assert.equal(result.correctCount,14);assert.equal(result.screeningPlacement?.needsReview,true);
  const guidance=learnerScreeningGuidance(result,'en')!;
  assert.equal(guidance.needsReview,false);assert.equal(guidance.review,'');assert.match(guidance.start,/HSK 3 consolidation and practical use/);
  const html=renderToStaticMarkup(React.createElement(HskAssessmentReport,{result,lang:'en'}));
  assert.doesNotMatch(html,/Tentative|verify the starting point|Saved|An initial starting-point/);
  assert.match(html,/14\/15/);assert.match(html,/Unanswered: 1/);
  assert.doesNotMatch(hskWhatsAppDraft({goal:'Work in China'},result,'en').message,/Tentative|Some items were unanswered/);
  assert.equal(JSON.stringify(result),original);
});
test('material missing answers, conflicting difficulty and audio failures retain a specific action',()=>{
  const a=sample([4,5,5]);a.answers[1]=null;
  const uncertain=learnerScreeningGuidance(gradeHskAttempt(a),'en')!;
  assert.equal(uncertain.needsReview,true);assert.match(uncertain.review,/could affect.*Ask an advisor/);
  const inconsistent=learnerScreeningGuidance(gradeHskAttempt(sample([2,5,5])),'en')!;
  assert.equal(inconsistent.reason,'inconsistent');assert.match(inconsistent.review,/difficulty levels/);
  const audio=sample();audio.audioFailures=[1];
  const r={...gradeHskAttempt(audio),saveStatus:'saved' as const};
  const html=renderToStaticMarkup(React.createElement(HskAssessmentReport,{result:r,lang:'en'}));
  assert.equal((html.match(/Some listening audio did not play correctly/g)||[]).length,1);
  assert.match(html,/Ask an advisor/);
});
test('successful reports hide routine status; failed synchronization keeps retry and Full denominators',()=>{
  const r={...gradeHskAttempt(sample([15,17,18],'full')),saveStatus:'saved' as const};
  const saved=renderToStaticMarkup(React.createElement(HskAssessmentReport,{result:r,lang:'en'}));
  assert.match(saved,/50\/50/);assert.doesNotMatch(saved,/Saved|Retry saving/);
  assert.match(learnerAssessmentGuidance(r,'en')!.start,/HSK 3 consolidation/);
  const local=renderToStaticMarkup(React.createElement(HskAssessmentReport,{result:{...r,saveStatus:'local'},lang:'en',onRetry:()=>{}}));
  assert.match(local,/Results have not synced/);assert.match(local,/Retry saving/);
});
test('sound instruction is first; fresh skip and paused status preserve different learner intentions',()=>{
  const html=renderToStaticMarkup(React.createElement(HSKPlacementAssessment,{studentName:'QA',lang:'en',onComplete:()=>{},onCancel:()=>{}}));
  assert.match(html,/<li>Turn sound on/);assert.match(html,/Skip assessment &amp; start AI consultation/);
  assert.doesNotMatch(html,/Back to consultation|Listening begins after you start/);
  assert.equal(getChatAssessmentStatus({chatAssessmentStatus:'paused',lastUpdated:'',leadProfile:{} as any}),'paused');
});
test('consultation question follows explicit request and supplied profile without leaking contact data',()=>{
  const p={goal:'Work in China',buyingSignal:'Which level is right',hskExamPlan:'Within 6 months',email:'PRIVATE@example.invalid',whatsapp:'PRIVATE PHONE',owner:'PRIVATE OWNER'};
  assert.equal(consultationFocus(p).topic,'work_scenarios');
  assert.equal(consultationFocus({...p,buyingSignals:['Asked price','Asked schedule']}).topic,'fees');
  assert.equal(consultationFocus({...p,buyingSignals:['Asked price']},'When does the class start?').topic,'schedule');
  assert.equal(consultationFocus({...p,buyingSignals:['Asked price']},'请告诉我开班时间').topic,'schedule');
  assert.equal(consultationFocus({goal:'Study in China or scholarship'}).topic,'study_destination');
  assert.equal(consultationFocus({goal:'Prepare for HSK certification',hskExamPlan:'Within 6 months'}).topic,'exam_target');
  assert.doesNotMatch(JSON.stringify(consultationProfile(p)),/PRIVATE/);
  assert.equal(consultationProfile(p)?.hskExamPlan,undefined);
  assert.equal(consultationProfile({...p,goal:'Prepare for HSK certification'})?.hskExamPlan,'Within 6 months');
  assert.equal(consultationProfile({...p,reportedLevel:'Beginner'},true)?.reportedLevel,undefined);
  assert.equal(consultationProfile({...p,reportedLevel:'Beginner'},true)?.selfReportedBeforeAssessment,'Beginner');
});
