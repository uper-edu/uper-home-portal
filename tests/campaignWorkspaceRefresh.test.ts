import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCampaignWorkspace} from '../src/utils/campaignWorkspaceRefresh';
test('campaign refresh returns the fresh cohort and stages with the totals',async()=>{
 const paths:string[]=[];
 const result=await loadCampaignWorkspace((async(path:any)=>{paths.push(path);return Response.json(path==='/api/crm/campaigns'?{campaigns:[{stats:{leadsCount:1,enrolledCount:1}}]}:{leads:[{id:'new',currentStage:'Enrolled'}]});}) as typeof fetch);
 assert.equal(result.leads[0].currentStage,'Enrolled');assert.equal(result.campaigns[0].stats.leadsCount,result.leads.length);assert.match(paths[1],/workScope=all/);
});
test('partial failure and malformed cohorts cannot be presented as successful refresh',async()=>{
 for(const response of [new Response('',{status:503}),Response.json({leads:null})]){
 await assert.rejects(loadCampaignWorkspace((async(path:any)=>path==='/api/crm/campaigns'?Response.json({campaigns:[]}):response) as typeof fetch));
 }
});
