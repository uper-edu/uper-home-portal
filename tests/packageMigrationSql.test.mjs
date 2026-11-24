import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {verifyPackagedMigrationSql} from '../scripts/lib/package-migration-sql.mjs';

test('release SQL guard detects missing, extra or changed migration files',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'uper-package-sql-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.join(root,'source');
  const packaged=path.join(root,'packaged');
  await fs.mkdir(source);
  await fs.mkdir(packaged);
  await fs.writeFile(path.join(source,'migrate.mjs'),"readFile(new URL('./schema.sql', import.meta.url));");
  await fs.writeFile(path.join(source,'schema.sql'),'SELECT 1;');
  const artifact=path.join(packaged,'schema.sql');
  const verify=()=>verifyPackagedMigrationSql(source,packaged);

  await assert.rejects(verify,/Missing: schema\.sql/);
  await fs.writeFile(artifact,'SELECT 2;');
  await assert.rejects(verify,/differs from source: schema\.sql/);
  await fs.writeFile(artifact,'SELECT 1;');
  const extra=path.join(packaged,'schema-old.sql');
  await fs.writeFile(extra,'SELECT 1;');
  await assert.rejects(verify,/Extra: schema-old\.sql/);
  await fs.unlink(extra);
  await verify();
});
