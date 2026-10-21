import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CampaignDateTimeField} from '../src/components/crm/CampaignDateTimeField.tsx';
import {campaignDateTimeValue,splitCampaignDateTime} from '../src/utils/campaignScheduleInput.ts';
import {campaignScheduleError} from '../src/utils/campaignWorkspace.ts';

test('combined controls round-trip campaign wall-clock values without timezone conversion',()=>{
 for(const [date,time] of [['2026-11-10','10:00'],['2026-11-11','00:00'],['2028-02-29','23:59']]){
  const value=campaignDateTimeValue(date,time);
  assert.equal(value,`${date}T${time}`);
  assert.deepEqual(splitCampaignDateTime(value),{date,time});
 }
 assert.deepEqual(splitCampaignDateTime(''),{date:'',time:''});
 for(const invalid of ['2026-02-29T12:30','2026-11-10T24:00','2026-11-10T10:60','2026-11-10','2026-11-10T10:30Z'])assert.equal(splitCampaignDateTime(invalid),null);
});

test('partial legacy facts remain visible, with explicit clear and no invented datetime',()=>{
 for(const [date,time] of [['2026-11-10',''],['','10:30'],['2026-02-30','10:30']]){
  assert.equal(campaignDateTimeValue(date,time),'');
  const html=renderToStaticMarkup(React.createElement(CampaignDateTimeField,{name:'startDateTime',label:'Start date and time',date,time,onChange:()=>{}}));
  assert.match(html,/type="datetime-local"/);assert.match(html,/value=""/);
  assert.match(html,/Kept until replaced or cleared/);assert.match(html,/Clear start date and time/);
  assert.ok(html.includes(date||'Date not recorded'));assert.ok(html.includes(time||'Time not recorded'));
 }
 const blank=renderToStaticMarkup(React.createElement(CampaignDateTimeField,{name:'startDateTime',label:'Start date and time',date:'',time:'',onChange:()=>{}}));
 assert.doesNotMatch(blank,/Recorded:|Kept until/);
});

test('combined edits retain existing split API fields and schedule ordering checks',()=>{
 const start=splitCampaignDateTime('2026-11-10T10:00')!,end=splitCampaignDateTime('2026-11-10T09:59')!;
 const payload={startDate:start.date,startTime:start.time,endDate:end.date,endTime:end.time};
 assert.equal(campaignScheduleError(payload),true);
 assert.equal(campaignScheduleError({...payload,endTime:'10:00'}),false);
 assert.equal(campaignScheduleError({...payload,endDate:'2026-11-11',endTime:'09:59'}),false);
});
