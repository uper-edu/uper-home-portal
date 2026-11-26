import {questionnaireOptions} from '../utils/crmQuestionnaire';
import {determineLevelState} from '../types/leadSystem';
import {visitorKey, visitorScope} from './visitorScope';

type QuestionnaireOptions=typeof questionnaireOptions;
export type ChatRegistrationPreferences=Partial<{
  [Key in 'currentStatus'|'reportedLevel'|'city'|'mode']:QuestionnaireOptions[Key][number];
}> & {
  goals?:QuestionnaireOptions['goal'][number][];
  buyingSignals?:QuestionnaireOptions['buyingSignal'][number][];
  cityDetail?:string;
  parentContact?:string;
};
export type ChatRegistrationDraft=ChatRegistrationPreferences & {fullName?:string; whatsapp?:string; email?:string};
export type ChatRegistrationStep='contact'|'preferences';
const key='uper_chat_registration_draft';

export function readChatRegistrationDraft(owner:string):ChatRegistrationDraft {
  if (!owner || visitorScope()!==owner) return {};
  try { return JSON.parse(sessionStorage.getItem(visitorKey(key))||'{}') ?? {}; } catch { return {}; }
}
export function writeChatRegistrationDraft(owner:string,draft:ChatRegistrationDraft) {
  if (!owner || visitorScope()!==owner) return;
  try {
    if (Object.keys(draft).length) sessionStorage.setItem(visitorKey(key),JSON.stringify(draft));
    else sessionStorage.removeItem(visitorKey(key));
  } catch {}
}

export function withoutChatRegistrationContact({fullName,whatsapp,email,...preferences}:ChatRegistrationDraft):ChatRegistrationPreferences {
  return preferences;
}

export function chatRegistrationAnswers(draft:ChatRegistrationDraft,step:ChatRegistrationStep) {
  const contacts={fullName:draft.fullName?.trim(),whatsapp:draft.whatsapp?.trim(),email:draft.email?.trim()};
  if (step==='contact') return contacts;
  const allowed=<Key extends keyof QuestionnaireOptions>(key:Key,value:unknown)=>
    questionnaireOptions[key].find(option=>option===value);
  const {currentStatus,reportedLevel,mode,city}=draft;
  const goals=questionnaireOptions.goal.filter(goal=>draft.goals?.includes(goal))
    .sort((a,b)=>draft.goals!.indexOf(a)-draft.goals!.indexOf(b));
  const topics=questionnaireOptions.buyingSignal.filter(topic=>draft.buyingSignals?.includes(topic))
    .sort((a,b)=>draft.buyingSignals!.indexOf(a)-draft.buyingSignals!.indexOf(b));
  return {
    ...contacts,
    currentStatus:allowed('currentStatus',currentStatus),
    parentContact:currentStatus==='High school student'?draft.parentContact?.trim()||undefined:undefined,
    levelState:reportedLevel&&allowed('reportedLevel',reportedLevel)?determineLevelState(reportedLevel):undefined,
    reportedLevel:allowed('reportedLevel',reportedLevel),
    mode:allowed('mode',mode),
    city:allowed('city',city),
    cityDetail:city==='Other'?draft.cityDetail?.trim()||undefined:undefined,
    goal:goals[0],goals:goals.length?goals:undefined,
    buyingSignal:topics[0],buyingSignals:topics.length?topics:undefined,
  };
}

export function chatRegistrationStepForPending(value:Record<string,unknown>|null):ChatRegistrationStep {
  return value&&Object.keys(questionnaireOptions).some(key=>value[key]!==undefined)?'preferences':'contact';
}
