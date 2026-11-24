import {performance} from 'node:perf_hooks';

const origin = 'http://localhost:3000';
const samples = Number(process.argv[2] ?? 100);
const shortCode = process.argv[3];
if (!Number.isInteger(samples) || samples < 1 || samples > 500)
  throw Error('Sample count must be an integer from 1 to 500');
if (shortCode && !/^[a-z0-9-]{1,80}$/i.test(shortCode))
  throw Error('Supply a local promotion short code without a URL or query');

const endpoints = new Map([
  ['page-en', '/enrollment?lang=en'],
  ['page-id', '/enrollment?lang=id'],
  ['catalog', '/api/enrollment/classes'],
  ['availability', '/api/enrollment/availability'],
]);
if (shortCode) endpoints.set('promotion-redirect', '/s/' + shortCode);

const response = await fetch(origin + '/api/version', {signal:AbortSignal.timeout(5000)});
if (!response.ok) throw Error('Unable to confirm the local build');
const {backend,frontend} = await response.json();
console.log(JSON.stringify({backend:backend?.buildId,frontend:frontend?.buildId,samples,sequential:true}));

const percentile = (values, fraction) => values.length
  ? Math.round(values[Math.ceil(values.length * fraction) - 1]) : null;
for (const [step,path] of endpoints) {
  const statuses = {};
  const successful = [];
  let bytes = 0;
  for (let i = -3; i < samples; i++) {
    const started = performance.now();
    try {
      const result = await fetch(origin + path, {cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});
      const payload = await result.arrayBuffer();
      if (i < 0) continue;
      statuses[result.status] = (statuses[result.status] ?? 0) + 1;
      if (step === 'promotion-redirect' ? result.status === 302 : result.ok) {
        successful.push(performance.now() - started);
        bytes += payload.byteLength;
      }
    } catch {
      if (i >= 0) statuses.transport_error = (statuses.transport_error ?? 0) + 1;
    }
  }
  successful.sort((a,b)=>a-b);
  console.log(JSON.stringify({step,statuses,successes:successful.length,
    p50Ms:percentile(successful,0.50),p95Ms:percentile(successful,0.95),
    averageBytes:successful.length ? Math.round(bytes/successful.length) : null}));
  if (successful.length !== samples) process.exitCode = 1;
}
