import test from 'node:test';import assert from 'node:assert/strict';
import {assertEditableCampaign,canonicalCampaignId,organicCampaignRecord,organicCampaignName} from '../src/utils/organicCampaign.ts';
import {firstTouchAttribution} from '../server/portal/attribution.ts';
test('Missing, home and organic chat entries normalize to one permanent source; unknown campaign IDs stay distinct',()=>{
  for(const input of [null,undefined,'','home','HOME',' organic '])assert.equal(canonicalCampaignId(input),'organic');
  assert.equal(canonicalCampaignId('test-other'),'test-other');
  for(const input of [{},{campaignId:'home'},{campaign:'home'},{campaignId:'organic'}])assert.deepEqual(firstTouchAttribution({},input),{campaign:'organic',campaignId:'organic'});
  assert.deepEqual(firstTouchAttribution({campaign:'Historical'},{campaignId:'home'}),{campaign:'Historical'});
  assert.deepEqual(firstTouchAttribution({campaign:'Saved',campaignId:'saved'},{campaignId:'home'}),{campaign:'Saved',campaignId:'saved'});
});
test('Permanent organic campaign has no invented event dates and rejects update, archive, alias and rename paths',()=>{
  const c=organicCampaignRecord('2026-10-15T00:00:00Z');assert.equal(c.id,'organic');assert.equal(c.code,'organic');assert.equal(c.status,'active');assert.equal(c.startDate,'');assert.equal(c.systemManaged,true);
  for(const input of [c,{id:'organic',status:'archived'},{id:'home'},{id:'other',code:'organic'},{id:'other',code:'HOME'},{id:'ORGANIC',code:'renamed'}])assert.throws(()=>assertEditableCampaign(input));
  assert.doesNotThrow(()=>assertEditableCampaign({id:'ordinary',code:'ordinary'}));
  assert.deepEqual(['en','id','zh'].map(organicCampaignName),['Non-campaign source','Sumber non-kampanye','非活动来源']);
});
