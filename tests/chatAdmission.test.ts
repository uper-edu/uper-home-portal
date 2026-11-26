import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import {mysqlConnectionLimit} from '../cloud/mysql/database.mjs';
import {chatAdmission} from '../server/portal/chatAdmission';

class TestResponse extends EventEmitter {
  destroyed=false;
  close() {
    this.destroyed=true;
    this.emit('close');
  }
}

test('Chat queues before database checkout, drops disconnected waiters, and admits in arrival order',async()=>{
  const limit=mysqlConnectionLimit-1;
  const admit=chatAdmission(limit);
  const occupied=await Promise.all(Array.from({length:limit},()=>admit(new TestResponse())));
  assert.ok(occupied.every(Boolean));

  const disconnected=new TestResponse(), second=new TestResponse(), third=new TestResponse();
  const arrival:number[]=[];
  const cancelled=admit(disconnected);
  const next=admit(second).then(release=>{arrival.push(2);return release;});
  const last=admit(third).then(release=>{arrival.push(3);return release;});
  await Promise.resolve();
  assert.deepEqual(arrival,[]);

  disconnected.close();
  assert.equal(await cancelled,undefined);
  assert.equal(await admit(disconnected),undefined);
  occupied.shift()!();
  const releaseNext=await next;
  assert.deepEqual(arrival,[2]);
  assert.equal(second.listenerCount('close'),0);
  assert.ok(releaseNext);
  releaseNext();
  const releaseLast=await last;
  assert.deepEqual(arrival,[2,3]);
  assert.ok(releaseLast);
  releaseLast();
  occupied.forEach(release=>release!());
});
