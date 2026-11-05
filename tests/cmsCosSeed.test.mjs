import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {loadCmsSeed,cmsSeedRoot} from '../cloud/mysql/cms-seed.mjs';
import {mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';

test('COS-16: the seed has 106 items and 208 valid permanent COS resources',async()=>{
 const {bundle,summary}=await loadCmsSeed();
 assert.equal(summary.content,106);assert.equal(summary.media,208);assert.equal(summary.bytes,51352764);
 assert.deepEqual(summary.programGallery,{hsk:3,csca:2,consultancy:2,tours:2});
 assert.doesNotMatch(JSON.stringify(bundle.collections),/\/images\/uploads\//);
 assert.deepEqual(summary,JSON.parse(await fs.readFile(new URL('preview.json',cmsSeedRoot),'utf8')));
 const output=execFileSync(process.execPath,['cloud/mysql/seeds/cms/v2/import.mjs','preview'],{encoding:'utf8'});
 assert.match(output,/preview/);
});

test('COS-17: seed checksum manifest covers all package files',async()=>{
 const lines=(await fs.readFile(new URL('SHA256SUMS',cmsSeedRoot),'utf8')).trim().split('\n');
 assert.equal(lines.length,212);
 for(const line of lines){const match=/^([a-f0-9]{64})  (.+)$/.exec(line);assert.ok(match);assert.equal(mediaDigest(await fs.readFile(new URL(match[2],cmsSeedRoot))),match[1],match[2]);}
});

test('COS-18: COS migration is additive, packaged, and contains no new foreign keys',async()=>{
 const sql=await fs.readFile(new URL('../cloud/mysql/schema-v16.sql',import.meta.url),'utf8');
 assert.match(sql,/MODIFY COLUMN content MEDIUMBLOB NULL/);assert.match(sql,/ADD COLUMN cos_url/);
 assert.doesNotMatch(sql,/\bFOREIGN KEY\b|\bREFERENCES\b|\bDROP\b|\bDELETE\b/);
 assert.match(await fs.readFile(new URL('../scripts/package-portal.mjs',import.meta.url),'utf8'),/'schema-v16.sql'/);
});
