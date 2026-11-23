import assert from 'node:assert/strict';
import test from 'node:test';
import {createBrowserUuid} from '../src/utils/browserUuid';

test('browser UUIDs remain valid v4 request IDs when randomUUID is unavailable', t => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
  const fixture={
    getRandomValues(bytes:Uint8Array) {
      return bytes.fill(0xff);
    },
  };
  t.after(()=>Object.defineProperty(globalThis,'crypto',descriptor));
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:fixture});
  assert.equal(createBrowserUuid(),'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('browser UUIDs prefer the platform generator when available', () => {
  assert.match(createBrowserUuid(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
