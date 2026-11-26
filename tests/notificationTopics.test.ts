import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import NotificationCenter,{NotificationTopicPanels,NotificationWorkspace,pollNotificationReads} from '../src/components/NotificationCenter';import{notificationTopics}from'../src/components/crm/operationsSections';
test('five direct entries have aligned translated titles and unique notification API tabs',()=>{assert.deepEqual(notificationTopics.map(s=>s.id),['notification-channels','notification-rules','notification-jobs','notification-audit','integration-readiness']);for(const s of notificationTopics)assert.equal(s.title.filter(Boolean).length,3);});
test('inactive unvisited notification panels make no embedded editor or requests',()=>{assert.equal(renderToStaticMarkup(React.createElement(NotificationTopicPanels,{topic:'notification-rules',enabled:false,lang:'en',isLight:true,canEdit:false})), '');});
test('notification readers receive five entries but no policy management controls',()=>{for(const lang of ['en','zh','id']as const){const html=renderToStaticMarkup(React.createElement(NotificationWorkspace,{topic:'notification-rules',onTopicChange(){},lang,isLight:true,canEdit:false}));for(const s of notificationTopics)assert.ok(html.includes(s.title[lang==='zh'?2:lang==='id'?1:0].replaceAll('&','&amp;')));assert.ok(!html.includes('Save Policies'));if(lang==='en')assert.doesNotMatch(html,/Add policy/);}});

test('five notification topics have five distinct semantic icons',async()=>{const {notificationTopicIcons}=await import('../src/components/crm/notificationTopicIcons');assert.deepEqual(Object.keys(notificationTopicIcons),notificationTopics.map(s=>s.id));assert.equal(new Set(Object.values(notificationTopicIcons)).size,5);});


test('notification polling skips in-flight reads, resumes, and stops on cleanup', async t => {
  t.mock.timers.enable({apis:['setInterval']});
  let calls=0;
  let finish=()=>{};
  const stop=pollNotificationReads(()=>{
    calls++;
    return new Promise<void>(resolve=>{finish=resolve;});
  });
  assert.equal(calls,1);
  t.mock.timers.tick(10000);
  assert.equal(calls,1);
  finish();
  await Promise.resolve();
  t.mock.timers.tick(10000);
  assert.equal(calls,2);
  stop();
  finish();
  await Promise.resolve();
  t.mock.timers.tick(10000);
  assert.equal(calls,2);
});
