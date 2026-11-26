import {visitorKey, visitorScope} from './visitorScope';

type AssessmentReturn = {attemptId:string; conversationId:string};
const key='uper_chat_assessment_return';
const memory=new Map<string,AssessmentReturn[]>();

function bindings(owner:string):AssessmentReturn[] {
  if (!owner || visitorScope()!==owner) return [];
  try {
    const stored=JSON.parse(localStorage.getItem(visitorKey(key))||'[]');
    if (Array.isArray(stored)) return stored.filter(binding=>
      typeof binding?.attemptId==='string' && typeof binding?.conversationId==='string');
  } catch {}
  return memory.get(owner)??[];
}

export function chatAssessmentReturn(owner:string,attemptId?:string):AssessmentReturn|undefined {
  const saved=bindings(owner);
  return attemptId?saved.find(binding=>binding.attemptId===attemptId):saved[saved.length-1];
}

export function rememberChatAssessment(owner:string,attemptId:string,conversationId:string) {
  if (!owner || visitorScope()!==owner) return false;
  const saved=bindings(owner);
  const existing=saved.find(binding=>binding.attemptId===attemptId);
  if (existing) return existing.conversationId===conversationId;
  const next=[...saved,{attemptId,conversationId}].slice(-20);
  try { localStorage.setItem(visitorKey(key),JSON.stringify(next)); }
  catch { memory.set(owner,next); }
  return true;
}

export const chatAssessmentSummaryId=(attemptId:string)=>'assessment-'+attemptId;
export const chatAssessmentReplyId=(attemptId:string)=>'reply-hsk-intro-'+attemptId;
