import assert from 'node:assert/strict';
import test from 'node:test';
import {selectVisitorScope} from '../src/services/visitorScope.ts';
import {readEnrollmentDraft,readVisitorContact,rememberVisitorContact,writeEnrollmentDraft} from '../src/services/visitorContact.ts';
import {enrollmentVisitorDigest,readEnrollmentSessionDigest} from '../server/portal/enrollmentVisitorSession.ts';

test('confirmed details are scoped, and an email-only confirmation never mixes people',t=>{
  const local=new Map<string,string>(),tab=new Map<string,string>();
  const storage=(values:Map<string,string>)=>({
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,value),
    removeItem:(key:string)=>values.delete(key),
  });
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{
    localStorage:storage(local),sessionStorage:storage(tab),dispatchEvent:()=>true,
  }});
  t.after(()=>{
    selectVisitorScope('');
    if(descriptor)Object.defineProperty(globalThis,'window',descriptor);
    else Reflect.deleteProperty(globalThis,'window');
  });
  selectVisitorScope('first');
  rememberVisitorContact('first',{email:' LEARNER@example.invalid ',fullName:'Maya',whatsapp:'+6281234567890'});
  assert.deepEqual(readVisitorContact('first'),{email:'learner@example.invalid',fullName:'Maya',whatsapp:'+6281234567890'});
  writeEnrollmentDraft('first','apply:A',{phone:''});
  assert.deepEqual(readEnrollmentDraft('first','apply:A'),{phone:''});
  assert.equal(readEnrollmentDraft('first','waitlist:A'),undefined);
  rememberVisitorContact('first',{email:'different@example.invalid'});
  assert.deepEqual(readVisitorContact('first'),{email:'different@example.invalid'});
  selectVisitorScope('second');
  rememberVisitorContact('first',{email:'late@example.invalid'});
  assert.equal(readVisitorContact('first'),undefined);
  assert.equal(readVisitorContact('second'),undefined);
  assert.equal(readEnrollmentDraft('first','apply:A'),undefined);
  selectVisitorScope('first');
  assert.deepEqual(readVisitorContact('first'),{email:'different@example.invalid'});
});

test('a newly issued enrollment verification cannot authorize another visitor',()=>{
  const token='a'.repeat(64),first='b'.repeat(64),second='c'.repeat(64);
  const digest=enrollmentVisitorDigest(token,first);
  const cookie='uper_enrollment_session=v2.'+token;
  assert.equal(readEnrollmentSessionDigest(cookie+'; uper_visitor='+first),digest);
  assert.notEqual(readEnrollmentSessionDigest(cookie+'; uper_visitor='+second),digest);
  assert.equal(readEnrollmentSessionDigest(cookie),undefined);
  assert.equal(readEnrollmentSessionDigest('uper_enrollment_session='+token+'; uper_visitor='+first),enrollmentVisitorDigest(token));
});
