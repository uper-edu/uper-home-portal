import assert from 'node:assert/strict';
import test from 'node:test';
import {installAbortSignalCompatibility} from '../src/utils/abortSignalCompatibility';
import {readEnrollmentClassDetails} from '../src/services/enrollmentClassDetails';

test('keeps native abort methods when available', () => {
  const {any,timeout,prototype:{throwIfAborted}}=AbortSignal;
  const reason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason')?.get;
  installAbortSignalCompatibility();
  assert.equal(AbortSignal.any,any);
  assert.equal(AbortSignal.timeout,timeout);
  assert.equal(AbortSignal.prototype.throwIfAborted,throwIfAborted);
  assert.equal(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason')?.get,reason);
});

test('older browsers retain cancellation and timeouts', async t => {
  for(const [target,name] of [
    [AbortSignal,'any'],[AbortSignal,'timeout'],[AbortSignal.prototype,'throwIfAborted'],
  ] as const) {
    const descriptor=Object.getOwnPropertyDescriptor(target,name)!;
    t.after(()=>{Object.defineProperty(target,name,descriptor);});
    Object.defineProperty(target,name,{...descriptor,value:undefined});
  }
  const reason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason')!;
  t.after(()=>Object.defineProperty(AbortSignal.prototype,'reason',reason));
  Reflect.deleteProperty(AbortSignal.prototype,'reason');
  installAbortSignalCompatibility();
  const first=new AbortController();
  const second=new AbortController();
  const combined=AbortSignal.any([first.signal,second.signal]);
  assert.equal(combined.reason,undefined);
  assert.doesNotThrow(()=>combined.throwIfAborted());
  const replacement=AbortSignal.timeout(1);
  await new Promise<void>(resolve=>replacement.addEventListener('abort',()=>resolve(),{once:true}));
  assert.equal(replacement.reason?.name,'TimeoutError');
  second.abort();
  first.abort();
  assert.throws(()=>combined.throwIfAborted(),{name:'AbortError'});
  assert.equal(combined.reason,second.signal.reason);
  assert.equal(AbortSignal.any([replacement,first.signal]).reason,replacement.reason);
  const deadline=AbortSignal.any([new AbortController().signal,AbortSignal.timeout(1)]);
  await new Promise<void>(resolve=>deadline.addEventListener('abort',()=>resolve(),{once:true}));
  assert.equal(deadline.reason?.name,'TimeoutError');
  assert.throws(()=>deadline.throwIfAborted(),{name:'TimeoutError'});

  t.mock.method(globalThis,'fetch',(_path:string,{signal}:RequestInit)=>
    new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})));
  const handleTemporaryFailure=t.mock.fn();
  const classSignal=AbortSignal.any([new AbortController().signal,AbortSignal.timeout(1)]);
  assert.deepEqual(await readEnrollmentClassDetails(['fixture'],classSignal,{onTemporaryFailure:handleTemporaryFailure}),[]);
  assert.equal(handleTemporaryFailure.mock.callCount(),1);
});
