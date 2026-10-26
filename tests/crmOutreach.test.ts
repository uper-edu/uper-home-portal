import test from 'node:test';
import assert from 'node:assert/strict';
import {identityMatch} from '../server/portal/identityReview.ts';
import {outreachPolicy,outreachText} from '../src/utils/crmOutreach.ts';
import {builtInRoles} from '../src/utils/accessControl.ts';
const employee=(id:string,role:string)=>({id,active:true,roles:[role],permissions:Object.keys(builtInRoles[role].grants),grants:Object.fromEntries(Object.entries(builtInRoles[role].grants).map(([k,v])=>[k,[v]]))});
test('identity matching never treats blanks or invalid contacts as evidence',()=>{
 for(const [a,b] of [[{email:'',whatsapp:'081234567890'},{email:'',whatsapp:'081234567891'}],[{email:'one@example.invalid'},{email:'two@example.invalid'}],[{whatsapp:'garbage 081234567890'},{whatsapp:'081234567890'}]])assert.deepEqual(identityMatch(a,b),[]);
 assert.deepEqual(identityMatch({email:' Test@Example.invalid '},{email:'test@example.invalid'}),['email']);
 assert.deepEqual(identityMatch({whatsapp:'081234567890'},{whatsapp:'+62 81234567890'}),['phone']);
});
test('outreach role/owner/identity/stop matrix and all three language messages',()=>{
 const sales=employee('A','sales'),manager=employee('M','crm_leader');
 assert.equal(outreachPolicy(sales,{owner:null}),'CLAIM_BEFORE_CONTACT');
 assert.equal(outreachPolicy(sales,{owner:'A'}),null);
 assert.equal(outreachPolicy(sales,{owner:'B'}),'CONTACT_PERMISSION_DENIED');
 assert.equal(outreachPolicy(sales,{owner:'A',identityReview:{pending:true}}),'IDENTITY_REVIEW_REQUIRED');
 assert.equal(outreachPolicy(manager,{owner:null,identityReview:{pending:true}}),'IDENTITY_REVIEW_REQUIRED');
 assert.equal(outreachPolicy(manager,{owner:null,identityReview:{pending:true}},'identity_verification'),null);
 assert.equal(outreachPolicy(manager,{contactArrangement:{state:'stopped'}}),'CONTACT_STOPPED');
 for(const code of ['CLAIM_BEFORE_CONTACT','CONTACT_PERMISSION_DENIED','IDENTITY_REVIEW_REQUIRED','CONTACT_STOPPED','CONTACT_OWNER_CHANGED','CONTACT_REASON_REQUIRED','IDENTITY_MANAGER_REQUIRED'])for(const lang of ['en','id','zh'])assert.notEqual(outreachText(code,lang),code);
});
