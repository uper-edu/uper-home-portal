import {createHash} from 'node:crypto';
import {lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {readPrivateFile} from '../../../../server/privateFile.mjs';

const sha256 = data => createHash('sha256').update(data).digest('hex');

function settingGroup(id) {
  const faculty = /^faculty:(profile|rate|photo|cv):/.exec(id);
  if (faculty) return 'faculty:'+faculty[1];
  if (id.startsWith('enrollment_template:')) return 'enrollment_template';
  if (id.startsWith('enrollment_batch:')) return 'enrollment_batch';
  if (id.startsWith('dashboard_monthly_kpi_v1:')) return 'dashboard_monthly_kpi';
  return 'other_settings';
}

function readSnapshot(filename) {
  const file = resolve(filename);
  const stat = lstatSync(file);
  if (!stat.isFile()) throw Error('Use the regular private SQL file produced by the exporter');
  const bytes = readPrivateFile(file, 'Snapshot requires owner-only permissions', stat.size);
  const sql = bytes.toString('utf8');
  const marker = /\nSET @uper_business_digest='([a-f0-9]{64})';\n?$/.exec(sql);
  if (!marker || sha256(sql.slice(0, marker.index)) !== marker[1]) {
    throw Error('Snapshot business digest is absent or mismatched');
  }
  const target = /^DO CASE WHEN BINARY DATABASE\(\) = BINARY CONVERT\(0x([a-f0-9]+) USING utf8mb4\).*?\n  AND BINARY @uper_environment = 'test' /.exec(sql);
  const database = target && Buffer.from(target[1], 'hex').toString('utf8');
  if (!database || !/^uper_trial_[a-z0-9_]+$/.test(database)) {
    throw Error('Snapshot is missing its company-test database binding');
  }

  const tables = new Map();
  const settingGroups = new Map();
  for (const line of sql.slice(0, marker.index).split('\n')) {
    const create = /^CREATE TEMPORARY TABLE uper_seed_([a-z_]+) LIKE \1;$/.exec(line);
    if (create) {
      if (tables.has(create[1])) throw Error('Duplicate snapshot table');
      tables.set(create[1], new Map());
      continue;
    }
    if (!line.startsWith('INSERT INTO ')) continue;
    const insert = /^INSERT INTO uper_seed_([a-z_]+)\([a-z_,]+\) VALUES\(CONVERT\(0x([a-f0-9]+) USING utf8mb4\),/.exec(line);
    if (!insert || !tables.has(insert[1])) throw Error('Unexpected snapshot row format');
    const [, table, keyHex] = insert;
    const key = Buffer.from(keyHex, 'hex').toString('utf8');
    const rows = tables.get(table);
    if (rows.has(key)) throw Error('Duplicate snapshot row');
    const rowHash = sha256(line);
    rows.set(key, rowHash);
    if (table === 'portal_settings') {
      const group = settingGroup(key);
      if (!settingGroups.has(group)) settingGroups.set(group, new Map());
      settingGroups.get(group).set(key, rowHash);
    }
  }
  if (!tables.size) throw Error('Snapshot contains no table declarations');
  return {sha256:sha256(bytes),businessDigest:marker[1],database,tables,settingGroups};
}

const counts = groups => Object.fromEntries([...groups].map(([key, rows]) => [key, rows.size]));
const metadata = snapshot => ({
  sha256:snapshot.sha256, businessDigest:snapshot.businessDigest, targetDatabase:snapshot.database,
  counts:counts(snapshot.tables), settings:counts(snapshot.settingGroups),
});

function differences(previous, candidate) {
  const result = {};
  for (const key of new Set([...previous.keys(), ...candidate.keys()])) {
    const oldRows = previous.get(key) ?? new Map();
    const newRows = candidate.get(key) ?? new Map();
    const change = {added:0, removed:0, changed:0};
    for (const [id, hash] of newRows) {
      if (!oldRows.has(id)) change.added++;
      else if (oldRows.get(id) !== hash) change.changed++;
    }
    for (const id of oldRows.keys()) if (!newRows.has(id)) change.removed++;
    if (change.added || change.removed || change.changed) result[key] = change;
  }
  return result;
}

try {
  const [candidateFile, previousFile, ...extra] = process.argv.slice(2);
  if (!candidateFile || extra.length) {
    throw Error('Usage: node compare-snapshots.mjs CANDIDATE.sql [PREVIOUS.sql]');
  }
  const candidate = readSnapshot(candidateFile);
  const previous = previousFile ? readSnapshot(previousFile) : undefined;
  console.log(JSON.stringify({
    candidate:metadata(candidate),
    ...(previous && {previous:metadata(previous), changes:differences(previous.tables, candidate.tables),
      settingChanges:differences(previous.settingGroups, candidate.settingGroups)}),
  }, null, 2));
} catch (error) {
  console.error(error.code ? 'Could not read the private snapshot ('+error.code+')' : error.message);
  process.exitCode = 1;
}
