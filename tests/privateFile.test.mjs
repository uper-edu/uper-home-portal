import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrivateFile,readPrivateFile} from '../server/privateFile.mjs';
import {grantFixtureReadToOthers} from './helpers/privateFileAcl.mjs';

test('private file creation is exclusive; permission checks follow the current file, not a cached decision',t=>{
  const directory=mkdtempSync(join(tmpdir(),'uper-private-file-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,"私有 'fixture' [a]&b.json");
  createPrivateFile(file,'synthetic-content');
  assert.throws(()=>createPrivateFile(file,'must not overwrite'));
  assert.equal(readPrivateFile(file).toString(),'synthetic-content');
  writeFileSync(file,Buffer.alloc(65537));
  assert.throws(()=>readPrivateFile(file));
  writeFileSync(file,'short again');
  grantFixtureReadToOthers(file);
  assert.throws(()=>readPrivateFile(file));
  assert.throws(()=>readPrivateFile(directory));
});
