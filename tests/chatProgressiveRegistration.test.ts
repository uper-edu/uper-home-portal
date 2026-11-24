import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chatRegistrationAnswers,chatRegistrationStepForPending,readChatRegistrationDraft,withoutChatRegistrationContact,writeChatRegistrationDraft} from '../src/services/chatRegistrationDraft';
import {chatAssessmentReturn,rememberChatAssessment} from '../src/services/chatAssessmentReturn';
import {getChatAssessmentStatus} from '../src/services/studentProfileStorage';
import {selectVisitorScope} from '../src/services/visitorScope';

test('Contact registration only uses explicitly entered contact fields',()=>{
  const draft={fullName:' Learner ',whatsapp:' +6281234567890 ',email:'learner@example.invalid',
    goals:['Prepare for HSK certification'] as const,mode:'Online' as const,reportedLevel:'Beginner' as const};
  const entered={...draft,goals:[...draft.goals]};
  assert.deepEqual(chatRegistrationAnswers(entered,'contact'),
    {fullName:'Learner',whatsapp:'+6281234567890',email:'learner@example.invalid'});
  assert.deepEqual(withoutChatRegistrationContact(entered),
    {goals:['Prepare for HSK certification'],mode:'Online',reportedLevel:'Beginner'});
  const preferences=chatRegistrationAnswers(withoutChatRegistrationContact(entered),'preferences');
  assert.equal('mode' in preferences && preferences.mode,'Online');
  assert.equal('levelState' in preferences && preferences.levelState,'PARTIAL');
  assert.equal('city' in preferences && preferences.city,undefined);
  assert.equal(chatRegistrationStepForPending({fullName:'Learner'}),'contact');
  assert.equal(chatRegistrationStepForPending({fullName:'Learner',mode:'Online'}),'preferences');
});

test('Registration drafts are per visitor, and an assessment attempt retains its first conversation', t=>{
  const own=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  const local=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const storage=()=>{const entries=new Map<string,string>();return {
    getItem:(key:string)=>entries.get(key)||null,
    setItem:(key:string,value:string)=>entries.set(key,value),
    removeItem:(key:string)=>entries.delete(key),
  };};
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage()});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage()});
  t.after(()=>{selectVisitorScope(''); for(const [key,previous] of [['localStorage',local],['sessionStorage',own]] as const){
    if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);
  }});
  selectVisitorScope('visitor-a');
  writeChatRegistrationDraft('visitor-a',{fullName:'Draft'});
  assert.deepEqual(readChatRegistrationDraft('visitor-a'),{fullName:'Draft'});
  assert.equal(rememberChatAssessment('visitor-a','assessment-1','chat-1'),true);
  assert.equal(rememberChatAssessment('visitor-a','assessment-2','chat-2'),true);
  assert.equal(rememberChatAssessment('visitor-a','assessment-1','chat-3'),false);
  assert.deepEqual(chatAssessmentReturn('visitor-a','assessment-1'),{attemptId:'assessment-1',conversationId:'chat-1'});
  assert.deepEqual(chatAssessmentReturn('visitor-a'),{attemptId:'assessment-2',conversationId:'chat-2'});
  selectVisitorScope('visitor-b');
  assert.deepEqual(readChatRegistrationDraft('visitor-a'),{});
  assert.deepEqual(readChatRegistrationDraft('visitor-b'),{});
  assert.equal(chatAssessmentReturn('visitor-a'),undefined);
  assert.equal(chatAssessmentReturn('visitor-b'),undefined);
});

test('Anonymous visitors retain deliberately paused assessment state',()=>{
  assert.equal(getChatAssessmentStatus({lastUpdated:'',chatAssessmentStatus:'paused'}),'paused');
  assert.equal(getChatAssessmentStatus({lastUpdated:'',chatAssessmentStatus:'pending'}),'pending');
});
