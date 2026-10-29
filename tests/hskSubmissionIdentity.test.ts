import assert from 'node:assert/strict';import {test} from 'node:test';import {randomUUID} from 'node:crypto';
import {newHskAttempt,gradeHskAttempt} from '../src/data/hskAssessment';
import {getVersionQuestions} from '../src/data/hskAssessmentVersions';
import {sameHskSubmission} from '../src/utils/hskSubmissionIdentity';
for(const mode of ['express','full'] as const){
 test(`${mode}: completion time alone is a retry; changed answers and telemetry are conflicts`,()=>{
  const a={...newHskAttempt(mode,randomUUID()),completedAt:new Date().toISOString()};
  const b={...structuredClone(a),completedAt:new Date(Date.parse(a.completedAt)+1000).toISOString()};
  assert.equal(sameHskSubmission(a,b),true);
  const q=getVersionQuestions(mode,a.examVersion,a.scoringVersion)[0];
  b.answers[q.id]=q.options[0].id;assert.equal(sameHskSubmission(a,b),false);
  const other=structuredClone(a);other.activeSeconds[q.id]=1;assert.equal(sameHskSubmission(a,other),false);
  assert.equal(gradeHskAttempt(a,'zh').score,gradeHskAttempt({...a,completedAt:b.completedAt},'zh').score);
 });
}
