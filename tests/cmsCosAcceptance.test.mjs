import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeCmsAcceptance} from '../scripts/cms-acceptance.mjs';

test('COS-24: successful logout persists the actual acceptance result',async()=>{
 const report={passed:true};let saved;
 await finalizeCmsAcceptance(report,{logout:async()=>({response:{status:200}}),persist:async result=>{saved={...result};}});
 assert.deepEqual(saved,{passed:true,logoutStatus:200});
});

test('COS-24: unsuccessful logout fails acceptance but still saves its receipt',async()=>{
 const report={passed:true};let saved;
 await assert.rejects(finalizeCmsAcceptance(report,{logout:async()=>({response:{status:403}}),persist:async result=>{saved={...result};}}),/CMS logout failed: HTTP 403/);
 assert.equal(saved.passed,false);assert.equal(saved.logoutStatus,403);assert.match(saved.logoutFailure,/HTTP 403/);
});

test('COS-24: logout network errors cannot skip a prior failure receipt',async()=>{
 const report={passed:false,failure:'Upload rejected'};let saved;
 await assert.rejects(finalizeCmsAcceptance(report,{logout:async()=>{throw Error('Network unavailable');},persist:async result=>{saved={...result};}}),/Network unavailable/);
 assert.equal(saved.passed,false);assert.equal(saved.failure,'Upload rejected');assert.equal(saved.logoutFailure,'Network unavailable');
});

test('COS-24: failure before login persists without attempting logout',async()=>{
 let saved;
 await finalizeCmsAcceptance({passed:false,failure:'Login rejected'},{persist:async result=>{saved={...result};}});
 assert.deepEqual(saved,{passed:false,failure:'Login rejected'});
});
