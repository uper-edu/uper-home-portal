import test from 'node:test';import assert from 'node:assert/strict';
import {filterAndSummarize,defaultLeadFilters} from '../src/utils/crmLeadFilters.ts';
import {stableCrmOrder} from '../src/utils/crmPolling.ts';
import {ownerManagerOnly} from '../src/utils/crmAccessPolicy.ts';
import {identityComparisonSubject} from '../server/portal/identityReview.ts';
import {canClaimForContact} from '../src/utils/crmOutreach.ts';
const row=(id:string,pending:boolean,submittedAt:string)=>({id,fullName:id,owner:'Fadhil',currentStage:'New',tier:'Hot',submittedAt,identityReview:{pending},attention:{tasks:[]}});
test('identity pending leads are first under every sort, only within the selected filters',()=>{
 const leads=[row('normal',false,'2026-10-20'),row('pending-old',true,'2026-10-01'),row('pending-new',true,'2026-10-10')];
 for(const sort of ['priority','newest','activity','deadline'] as const){const result=filterAndSummarize(leads,{...defaultLeadFilters('all'),sort},'Fadhil','Asia/Jakarta',Date.parse('2026-10-22T00:00:00Z'));assert.ok(result.leads.slice(0,2).every(l=>l.identityReview.pending));assert.equal(result.leads[2].id,'normal');assert.equal(result.total,3);}
 const filtered=filterAndSummarize(leads,{...defaultLeadFilters('all'),search:'normal'},'Fadhil','Asia/Jakarta',Date.now());assert.deepEqual(filtered.leads.map(l=>l.id),['normal']);
});
test('background refresh pins new identity cases and restores server order after a decision',()=>{
 const normal=row('normal',false,'2026-10-20'),p=row('pending',true,'2026-10-01');assert.deepEqual(stableCrmOrder([normal],[p,normal]).map(l=>l.id),['pending','normal']);
 assert.deepEqual(stableCrmOrder([p,normal],[normal,{...p,identityReview:{pending:false}}]).map(l=>l.id),['normal','pending']);
});
test('owner restriction defaults off; previous inverse choice is preserved without rewriting configuration',()=>{
 assert.equal(ownerManagerOnly(undefined),false);assert.equal(ownerManagerOnly({selfClaimEnabled:true}),false);assert.equal(ownerManagerOnly({selfClaimEnabled:false}),true);assert.equal(ownerManagerOnly({ownerAssignmentManagerOnly:false,selfClaimEnabled:false}),false);
 const e:any={id:'Fadhil',active:true,roles:['sales'],permissions:['crm.read','crm.followup','crm.own','crm.claim'],grants:{'crm.read':['own'],'crm.followup':['own'],'crm.own':['own'],'crm.claim':['all']}};
 const lead:any={owner:null,identityReview:{pending:false,ownerAssignmentManagerOnly:true}};assert.equal(canClaimForContact(e,lead),false);assert.equal(canClaimForContact({...e,roles:['sales','crm_leader']},lead),true);assert.equal(canClaimForContact(e,{...lead,identityReview:{pending:false,ownerAssignmentManagerOnly:false}}),true);assert.equal(canClaimForContact({...e,roles:['sales','crm_leader']},{...lead,identityReview:{pending:true}}),false);
});
test('comparison sides use recorded candidate provenance, never infer a verified person',()=>{
 assert.equal(identityComparisonSubject([{lead_id:'new',candidate_id:'existing',decision:'pending'}]),'new');
 assert.equal(identityComparisonSubject([{lead_id:'new',decision:'pending'},{lead_id:'existing',decision:'pending'}]),null);
 assert.equal(identityComparisonSubject([{lead_id:'old',decision:'same'},{lead_id:'new',decision:'pending'}]),'new');
});
