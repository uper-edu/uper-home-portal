import test from 'node:test';import assert from 'node:assert/strict';
import {historyFirstInstant,historyElapsedLabel} from '../src/utils/crmHistoryElapsed';
test('baseline uses complete history regardless of visible search results',()=>{
 const all=[{displayAt:'2026-10-01T01:00:00Z'},{displayAt:null},{displayAt:'invalid'},{displayAt:'2026-10-01T00:00:00Z'}];
 const base=historyFirstInstant(all);assert.equal(base,Date.parse('2026-10-01T00:00:00Z'));
 assert.equal(historyElapsedLabel(all[0].displayAt,base),' +1小时'.trim());assert.equal(historyFirstInstant([]),null);
});
test('elapsed ranges and three languages',()=>{
 const base=Date.parse('2026-10-01T00:00:00Z');const at=(s:number)=>new Date(base+s*1000).toISOString();
 assert.equal(historyElapsedLabel(at(0),base),'起点');assert.equal(historyElapsedLabel(at(30),base),'+30秒');assert.equal(historyElapsedLabel(at(1500),base),'+25分钟');assert.equal(historyElapsedLabel(at(12000),base),'+3小时20分');assert.equal(historyElapsedLabel(at(183600),base),'+2天3小时');assert.equal(historyElapsedLabel(at(183600),base,'en'),'+2d 3h');assert.equal(historyElapsedLabel(at(183600),base,'id'),'+2 hari 3 jam');
});
test('missing instants remain unknown; offsets represent the same instant',()=>{
 const base=Date.parse('2026-10-01T00:00:00Z');assert.equal(historyElapsedLabel(null,base),'—');assert.equal(historyElapsedLabel('invalid',base),'—');assert.equal(historyElapsedLabel('2026-10-01T07:00:00+07:00',base,'en'),'Start');assert.equal(historyElapsedLabel('2026-09-30T23:00:00Z',base),'—');
});
