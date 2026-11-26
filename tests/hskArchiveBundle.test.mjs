import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import {emitHskArchives} from '../scripts/lib/hskArchiveBundle.mjs';
import {readHskVersionArchive} from '../src/data/hskVersionArchives.ts';

test('the browser archive pack preserves each published JSON and reduces the compressed payload', async () => {
  const directory = new URL('../src/data/hskVersions/', import.meta.url);
  const archives = Object.fromEntries(readdirSync(directory).filter(name => name.endsWith('.json')).map(name => [
    name, JSON.parse(readFileSync(new URL(name, directory), 'utf8')),
  ]));
  const moduleSource = emitHskArchives(archives);
  const {default:packed} = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
  const names=Object.keys(packed);
  for(const archive of Object.values(archives))assert.deepEqual(readHskVersionArchive(archive.examVersion),archive);
  assert.ok(names.every(name=>typeof Object.getOwnPropertyDescriptor(packed,name)?.get==='function'));
  const firstAccess=packed[names[0]];
  assert.strictEqual(packed[names[0]],firstAccess);
  assert.ok(names.slice(1).every(name=>typeof Object.getOwnPropertyDescriptor(packed,name)?.get==='function'));
  assert.equal(JSON.stringify(packed), JSON.stringify(archives));
  const [first, second] = Object.values(packed);
  assert.notEqual(first.questions[0].options, second.questions[0].options);
  assert.ok(gzipSync(moduleSource).length < gzipSync(JSON.stringify(archives)).length);
});
