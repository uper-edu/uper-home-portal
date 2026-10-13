import type { HskLanguage, HskResult } from './hskAssessment';
import { getVersionQuestions, requireHskVersion } from './hskAssessmentVersions';
import { deriveScreeningPlacement, screeningGuidance } from './hskScreeningPlacement';

/** Presentation advice only: never mutate an archived grade or its sampling flags. */
export function learnerScreeningGuidance(result: HskResult, lang: HskLanguage) {
  if (!result.screeningPlacement) return undefined;
  const original = result.screeningPlacement;
  const counts = [1,2,3].map(n=>result.breakdown[`hsk${n}Correct` as keyof typeof result.breakdown]);
  const questions = getVersionQuestions(result.attempt.mode,result.attempt.examVersion,result.attempt.scoringVersion);
  const missing = [1,2,3].map(n=>questions.filter(q=>q.level===`HSK ${n}` && !result.attempt.answers[q.id]).length);
  const pass = requireHskVersion(result.attempt.examVersion,result.attempt.scoringVersion).screeningPolicy!.passCountPerLevel;
  const upper = deriveScreeningPlacement(counts.map((n,i)=>n+missing[i]),15,[],pass);
  const effective = original.reason==='incomplete' && upper.stage===original.stage
    ? deriveScreeningPlacement(counts,15,result.attempt.audioFailures,pass) : original;
  const text = screeningGuidance(effective,lang);
  const t=(zh:string,en:string,id:string)=>({zh,en,id})[lang];
  const reasons = {
    clear: '',
    incomplete: t('未答题可能影响学习起点，建议请顾问进一步确认。','Unanswered items could affect your starting point. Ask an advisor to help confirm it.','Soal kosong dapat memengaruhi titik awal. Minta konsultan membantu memastikannya.'),
    inconsistent: t('不同难度的表现不一致，建议请顾问进一步确认基础。','Results vary across difficulty levels. Ask an advisor to help check your foundation.','Hasil antar tingkat kesulitan berbeda. Minta konsultan membantu memeriksa dasar Anda.'),
    boundary: t('结果接近学习起点的分界，建议请顾问进一步确认。','Your result is close to a starting-point boundary. Ask an advisor to help confirm it.','Hasil mendekati batas titik awal. Minta konsultan membantu memastikannya.'),
    audio_error: t('部分听力未正常播放，建议请顾问进一步确认听力基础。','Some listening audio did not play correctly. Ask an advisor to help check your listening.','Sebagian audio tidak diputar dengan benar. Minta konsultan membantu memeriksa kemampuan menyimak.'),
  };
  return {
    adviceVersion: 'learner-startpoint-presentation-v2',
    ...text,
    start: effective.stage===3 ? t('HSK 3巩固与实际应用','HSK 3 consolidation and practical use','Penguatan HSK 3 dan penggunaan praktis')
      : t(`HSK ${effective.suggestedStartLevel}内容`,`HSK ${effective.suggestedStartLevel} content`,`Materi HSK ${effective.suggestedStartLevel}`),
    review: reasons[effective.reason],
    needsReview: effective.needsReview,
    reason: effective.reason,
  };
}

export function learnerAssessmentGuidance(result: HskResult, lang: HskLanguage) {
  if(result.attempt.mode==='express')return learnerScreeningGuidance(result,lang);
  const version=requireHskVersion(result.attempt.examVersion,result.attempt.scoringVersion);
  const counts=[1,2,3].map(n=>result.breakdown[`hsk${n}Correct` as keyof typeof result.breakdown]);
  const missing=[1,2,3].map(n=>version.questions.filter(q=>q.level===`HSK ${n}`&&!result.attempt.answers[q.id]).length);
  const highest=(values:number[])=>['hsk1','hsk2','hsk3'].filter(key=>Object.entries(version.fullPassCounts[key as keyof typeof version.fullPassCounts]).every(([level,required])=>values[Number(level.slice(3))-1]>=required)).length;
  const stage=highest(counts),upper=highest(counts.map((n,i)=>n+missing[i]));
  const t=(zh:string,en:string,id:string)=>({zh,en,id})[lang];
  const audio=result.attempt.audioFailures.length>0;
  return {adviceVersion:'learner-startpoint-presentation-v2',start:stage===3?t('HSK 3巩固与实际应用','HSK 3 consolidation and practical use','Penguatan HSK 3 dan penggunaan praktis'):t(`HSK ${Math.min(3,stage+1)}内容`,`HSK ${Math.min(3,stage+1)} content`,`Materi HSK ${Math.min(3,stage+1)}`),
    needsReview:audio||upper!==stage,reason:audio?'audio_error':upper!==stage?'incomplete':'clear',
    review:audio?t('部分听力未正常播放，建议请顾问进一步确认听力基础。','Some listening audio did not play correctly. Ask an advisor to help check your listening.','Sebagian audio tidak diputar dengan benar. Minta konsultan membantu memeriksa kemampuan menyimak.'):upper!==stage?t('未答题可能影响学习起点，建议请顾问进一步确认。','Unanswered items could affect your starting point. Ask an advisor to help confirm it.','Soal kosong dapat memengaruhi titik awal. Minta konsultan membantu memastikannya.'):'',};
}
