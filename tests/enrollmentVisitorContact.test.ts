import assert from 'node:assert/strict';
import test from 'node:test';
import {selectVisitorScope} from '../src/services/visitorScope.ts';
import {readEnrollmentDraft,readVisitorContact,rememberVisitorContact,writeEnrollmentDraft} from '../src/services/visitorContact.ts';
import {enrollmentVisitorDigest,readEnrollmentSessionDigest,readEnrollmentEmailSession,revokeEnrollmentEmailSession} from '../server/portal/enrollmentVisitorSession.ts';

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

test('enrollment reuses only the unexpired email belonging to the current visitor and cookie',async()=>{
  const token='a'.repeat(64),visitor='b'.repeat(64),other='c'.repeat(64);
  const email='learner@example.invalid';
  let active=true;
  const digest=enrollmentVisitorDigest(token,visitor);
  const client={async query(sql:string,values?:unknown[]){
    assert.match(sql,/expires_at>UTC_TIMESTAMP/);
    return {rows:active&&values?.[0]===digest?[{email}]:[]};
  }};
  const cookie=(scope:string)=>'uper_enrollment_session=v2.'+token+'; uper_visitor='+scope;
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),' Learner@EXAMPLE.INVALID '),email);
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),'someone-else@example.invalid'),undefined);
  assert.equal(await readEnrollmentEmailSession(client,cookie(other),email),undefined);
  assert.equal(await readEnrollmentEmailSession(client,undefined,email),undefined);
  active=false;
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),email),undefined);
});

test('logout revokes only the presented visitor session and an old tab cannot sign out a replacement email',async()=>{
  const token='a'.repeat(64),visitor='b'.repeat(64),otherVisitor='c'.repeat(64);
  const source=enrollmentVisitorDigest(token,visitor),other=enrollmentVisitorDigest(token,otherVisitor);
  const rows=new Map([[source,{email:'current@example.invalid'}],[other,{email:'current@example.invalid'}]]);
  const client={async query(sql:string,args?:unknown[]){
    const digest=String(args?.[0]);
    if(sql.startsWith('DELETE')) {
      rows.delete(digest);
      return {rows:[]};
    }
    const row=rows.get(digest);
    return {rows:row?[row]:[]};
  }};
  const cookies='uper_enrollment_session=v2.'+token+'; uper_visitor='+visitor;
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'old@example.invalid'),false);
  assert.equal(rows.size,2);
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'current@example.invalid'),true);
  assert.equal(await readEnrollmentEmailSession(client,cookies),undefined);
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'current@example.invalid'),true);
  assert.equal(rows.has(other),true);
});
