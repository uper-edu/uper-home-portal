import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCmsSeed} from '../cloud/mysql/cms-seed.mjs';
import {cmsMediaUrl, mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
import {generateIncrementalSql, outputUrl, main} from '../scripts/generate-cms-cos-incremental.mjs';
import {validateManifest, transformItems, imageFields, collectionNames, procedureNames} from '../scripts/lib/cms-cos-incremental.mjs';

const {bundle, media, summary} = await loadCmsSeed();
const rows = validateManifest(bundle, media);
const sql = await generateIncrementalSql();
const aliases = new Map(rows.flatMap(row => [[row.url, row], [`/images/uploads/${row.id}.webp`, row]]));
const present = new Set(rows.map(x => x.id));
const first = rows[0], second = rows[1];
const local = row => `/images/uploads/${row.id}.webp`;
const transform = items => transformItems(items, aliases, present);

test('checked-in standalone SQL is byte-reproducible and --check validates it', async () => {
  assert.equal(await readFile(outputUrl, 'utf8'), sql);
  assert.equal(await generateIncrementalSql(), sql);
  await main(['--check']);
  await assert.rejects(main(['--output', 'other.sql']), /Usage/);
});

test('official 208 objects carry exact hashes, byte counts, URL and keys', () => {
  assert.equal(summary.content, 106);
  assert.equal(rows.length, 208);
  assert.equal(rows.reduce((sum, row) => sum + row.bytes, 0), 51352764);
  for (const row of rows) {
    assert.equal(mediaDigest(media.get(row.id)), row.id);
    assert.equal(media.get(row.id).length, row.bytes);
    assert.equal(row.url, cmsMediaUrl(row.id, {}));
    assert.ok(sql.includes(`('${row.id}','${row.url}','${row.objectKey}',${row.bytes})`));
  }
  const damaged = structuredClone(bundle); damaged.media[0].bytes++;
  assert.throws(() => validateManifest(damaged, media), /manifest/);
  const missing = new Map(media); missing.delete(first.id);
  assert.throws(() => validateManifest(bundle, missing), /checksum/);
});

test('standalone SQL contains no credentials, fixed database, foreign keys or unrelated writes', () => {
  assert.doesNotMatch(sql, /(?:SECRET[_ ]?(?:ID|KEY)|PASSWORD\s*=|IDENTIFIED BY|\bDEFINER\s*=|\bUSE\s+[`\w]+\s*;|\bCREATE\s+DATABASE|\bFOREIGN KEY|\bREFERENCES\b|\bCOLLATE\b|\bTRUNCATE\b|\bDELETE\s+FROM|\bREPLACE\s*\(|\bDROP\s+TABLE|\bSET\s+SESSION|\.env|\.local-backups|\b(?:\d{1,3}\.){3}\d{1,3}\b)/i);
  assert.doesNotMatch(sql, /crm_users|access_|trial_campaigns|outbox|notification/i);
  const writes = [...sql.matchAll(/^\s*(?:UPDATE|INSERT INTO)\s+([a-z_0-9]+)/gmi)].map(x => x[1]);
  assert.ok(writes.every(name => ['cms_media', 'cms_collections', 'trial_schema_versions'].includes(name) || name.startsWith('tmp_uper_cos_20261105_')));
  assert.doesNotMatch(sql, /INSERT INTO cms_(media|collections)/i);
  assert.doesNotMatch(sql, /SET\s+(?:m\.)?content\s*=|DROP\s+(?:PROCEDURE|TEMPORARY TABLE)\s+IF EXISTS/i);
});

test('delimiter protocol, invoker security, rollback, lock release and routine ownership', () => {
  assert.ok(sql.includes('DELIMITER $$'));
  assert.equal((sql.match(/SQL SECURITY INVOKER/g) || []).length, 3);
  assert.match(sql, /DECLARE EXIT HANDLER FOR SQLEXCEPTION[\s\S]*?ROLLBACK;[\s\S]*?RELEASE_LOCK\(lock_name\)[\s\S]*?RESIGNAL;/);
  assert.match(sql, /GET_LOCK\(lock_name,0\)/);
  assert.match(sql, /START TRANSACTION; SET in_dml=TRUE;/);
  assert.match(sql, /COMMIT; SET in_dml=FALSE;/);
  for (const name of procedureNames) {
    assert.ok(sql.includes(`CREATE PROCEDURE ${name}`));
    assert.ok(sql.includes(`DROP PROCEDURE ${name}$$`));
  }
  assert.match(sql, /no --force/);
  assert.match(sql, /DDL commits independently/);
});

test('schema gating restricts v16 DDL and verifies recovery instead of blindly rerunning ALTER', () => {
  assert.equal((sql.match(/ALTER TABLE cms_media/g) || []).length, 1);
  assert.match(sql, /Partial\/inconsistent v16 schema/);
  assert.match(sql, /IF state_value IS NOT NULL OR storage_count<>0/);
  assert.match(sql, /ELSEIF state_value='applying' THEN/);
  assert.match(sql, /v16 post-DDL verification failed/);
  assert.match(sql, /WHERE version=16/);
  assert.match(sql, /is_visible='YES'/);
  assert.match(sql, /Required primary key mismatch/);
  assert.match(sql, /Review custom triggers/);
  assert.doesNotMatch(sql, /version\s*=\s*(?:1[0-57-9]|[1-9])\b/);
});

test('DEFAULT_GENERATED timestamp defaults are allowed without inspecting EXTRA', () => {
  // DEFAULT CURRENT_TIMESTAMP(6) has EXTRA=DEFAULT_GENERATED but an empty
  // GENERATION_EXPRESSION. Gate the latter, never the shared GENERATED substring.
  assert.doesNotMatch(sql, /extra\s+NOT LIKE\s+'%GENERATED%'/i);
  const timestampChecks = sql.split('\n').filter(line => line.includes('Required column mismatch:') && /column_name='(?:created_at|updated_at)'/.test(line));
  assert.equal(timestampChecks.length, 3);
  for (const check of timestampChecks) {
    assert.ok(check.includes("COALESCE(generation_expression,'')=''"));
    assert.doesNotMatch(check, /\bextra\b/i);
  }
});

test('required-column and storage gates reject nonempty virtual or stored generation expressions', () => {
  // Both VIRTUAL GENERATED and STORED GENERATED expose a nonempty expression;
  // the emitted equality must reject it regardless of EXTRA spelling.
  const requiredChecks = sql.split('\n').filter(line => line.includes('Required column mismatch:'));
  assert.equal(requiredChecks.length, 14);
  for (const check of requiredChecks) assert.ok(check.includes("COALESCE(generation_expression,'')=''"));
  for (const column of ['storage_type', 'cos_url', 'object_key', 'byte_size']) {
    const storageChecks = sql.split('\n').filter(line => line.includes(`(column_name='${column}' AND`));
    assert.equal(storageChecks.length, 2, `${column}: pre-DDL and post-DDL checks`);
    for (const check of storageChecks) assert.ok(check.includes("COALESCE(generation_expression,'')=''"));
  }
});

test('real SQL media path locks, verifies BLOB on server, rejects conflicts and preserves payload', () => {
  assert.match(sql, /SELECT id FROM cms_media ORDER BY id FOR UPDATE/);
  assert.match(sql, /SHA2\(content,256\),OCTET_LENGTH\(content\)/);
  assert.match(sql, /Target media BLOB hash\/size mismatch/);
  assert.match(sql, /Conflicting target COS URL/);
  assert.match(sql, /NULL BLOB requires matching complete COS metadata/);
  assert.match(sql, /Known CMS reference has no target media row/);
  const update = sql.match(/UPDATE cms_media m[\s\S]*?;/)[0];
  assert.doesNotMatch(update, /content|legacy_name|uploaded_by|created_at|mime/);
  assert.match(update, /needs_update=1/);
  assert.match(sql, /0 AS blobs_cleared/);
});

test('execution header requires abort-on-error batch and rejects ordinary interactive SOURCE', () => {
  const header = sql.slice(0, sql.indexOf('DELIMITER $$'));
  assert.match(header, /Only abort-on-error batch execution is supported/);
  assert.match(header, /NEW mysql client process with stdin file redirection, no --force/);
  assert.match(header, /Ordinary interactive SOURCE is NOT supported/);
  assert.match(header, /GUI batch execution must enable abort on error/);
});

test('existing nonempty object key conflicts fail independently of valid BLOB or URL', () => {
  const guard = "IF actual_key IS NOT NULL AND OCTET_LENGTH(actual_key)>0 AND CAST(actual_key AS BINARY)<>CAST(wanted_key AS BINARY) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target COS object key'; END IF;";
  assert.ok(sql.includes(guard));
  assert.ok(sql.indexOf(guard) < sql.indexOf('IF actual_hash IS NULL AND NOT'));
  assert.ok(sql.indexOf(guard) < sql.indexOf('UPDATE tmp_uper_cos_20261105_map SET present=1'));
});

test('existing non-NULL byte size conflicts fail independently of valid BLOB or URL', () => {
  const guard = "IF actual_size IS NOT NULL AND actual_size<>wanted_size THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target COS byte size'; END IF;";
  assert.ok(sql.includes(guard));
  assert.ok(sql.indexOf(guard) < sql.indexOf('IF actual_hash IS NULL AND NOT'));
  assert.ok(sql.indexOf(guard) < sql.indexOf('UPDATE tmp_uper_cos_20261105_map SET present=1'));
});

test('SQL traversal is generated from the same limited field contract as reference model', () => {
  for (const field of imageFields) assert.ok(sql.includes(`CONCAT(base,'.${field}')`));
  for (const collection of collectionNames) assert.ok(sql.includes(`'${collection}'`));
  assert.match(sql, /\.images\[/);
  assert.match(sql, /CONCAT\(p,'\.asset.url'\)/);
  assert.match(sql, /COALESCE\(items_text,CAST\(items AS CHAR CHARACTER SET utf8mb4\)\)/);
  assert.match(sql, /SET doc=CAST\(raw_text AS JSON\)/);
  assert.match(sql, /c.items=CAST\(s.doc AS JSON\),c.items_text=CAST\(s.doc AS CHAR CHARACTER SET utf8mb4\)/);
  assert.match(sql, /IF ci>0 THEN/);
  assert.match(sql, /c.revision=c.revision\+1/);
});

test('known legacy alias maps exactly; substrings, unknown images and prose remain unchanged', () => {
  const old = local(first), unknown = '/images/uploads/my-own.webp';
  const fixture = [{_id: 'custom', title: old, body: [{text: old}], image: old, logo: `${old}?size=2`, avatar: unknown}];
  const result = transform(fixture);
  assert.equal(result.items[0].image, first.url);
  assert.equal(result.items[0].title, old);
  assert.deepEqual(result.items[0].body, fixture[0].body);
  assert.equal(result.items[0].logo, `${old}?size=2`);
  assert.equal(result.items[0].avatar, unknown);
  assert.equal(result.refsChanged, 1);
  assert.equal(result.refsUncovered, 2);
  assert.equal(fixture[0].image, old);
  const aliasMap = new Map(aliases); aliasMap.set('/images/uploads/old-file.webp', first);
  assert.equal(transformItems([{_id: 'alias', image: '/images/uploads/old-file.webp'}], aliasMap, present).items[0].image, first.url);
});

test('all image shapes and multiple images preserve business data and crop floats', () => {
  const crop = {top: 0.10000000000000003, left: 0.4567890123456789, bottom: 0, right: 1};
  const fixture = [{_id: 'custom-id', _cmsVersion: 7, _updatedAt: 'unchanged', slug: {current: 'custom'}, status: 'draft', order: 17,
    image: {url: local(first), crop}, certificateImage: {asset: {url: local(second), _ref: 'leave-reference'}, hotspot: {x: 0.30000000000000004}},
    images: [local(first), {asset: {url: local(second)}, caption: 'keep'}, {url: first.url}, {url: '/own-image.png'}]}];
  const result = transform(fixture);
  assert.equal(result.refsChanged, 4); assert.equal(result.itemsChanged, 1); assert.equal(result.refsUncovered, 1);
  assert.equal(result.items[0]._cmsVersion, 8);
  assert.deepEqual(result.items[0].image.crop, crop);
  for (const key of ['_id', '_updatedAt', 'slug', 'status', 'order']) assert.deepEqual(result.items[0][key], fixture[0][key]);
  assert.equal(result.items[0].certificateImage.asset._ref, 'leave-reference');
  assert.equal(result.items[0].images.length, 4);
});

test('only changed items increment; repeated and already-COS executions are no-ops', () => {
  const original = [{_id: 'changed', image: local(first)}, {_id: 'same', _cmsVersion: 42, image: second.url}];
  const once = transform(original), twice = transform(once.items);
  assert.equal(once.items[0]._cmsVersion, 1); assert.deepEqual(once.items[1], original[1]);
  assert.equal(twice.itemsChanged, 0); assert.equal(twice.refsChanged, 0); assert.deepEqual(twice.items, once.items);
  for (const items of Object.values(bundle.collections)) {
    const result = transform(items); assert.equal(result.refsChanged, 0); assert.equal(result.itemsChanged, 0); assert.equal(result.refsUncovered, 0);
  }
});

test('known missing media fails for local and COS URLs; unknown URLs remain uncovered', () => {
  const missing = new Set(present); missing.delete(first.id);
  for (const url of [local(first), first.url]) assert.throws(() => transformItems([{_id: 'x', image: url}], aliases, missing), /no media row/);
  const result = transformItems([{_id: 'x', image: '/private/image.webp'}], aliases, missing);
  assert.equal(result.itemsChanged, 0); assert.equal(result.refsUncovered, 1);
});

test('invalid authority shape, identity or changed-item version fails closed', () => {
  assert.throws(() => transform({}), /array/);
  for (const item of [{image: local(first)}, {_id: 7, image: local(first)}, {_id: '', image: local(first)}]) assert.throws(() => transform([item]), /identity/);
  for (const version of ['3', -1, 1.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => transform([{_id: 'x', image: local(first), _cmsVersion: version}]), /version/i);
  assert.equal(transform([{_id: 'x', image: local(first), _cmsVersion: null}]).items[0]._cmsVersion, 1);
});
