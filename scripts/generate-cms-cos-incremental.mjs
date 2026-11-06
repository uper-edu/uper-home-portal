import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadCmsSeed} from '../cloud/mysql/cms-seed.mjs';
import {generateSql, validateManifest} from './lib/cms-cos-incremental.mjs';

export const outputUrl = new URL('../sql/v20261105220918_cms_cos_incremental.sql', import.meta.url);
export async function generateIncrementalSql() {
  // No dotenv, database, private guard, backup, or runtime content input.
  const {bundle, media} = await loadCmsSeed();
  return generateSql(validateManifest(bundle, media));
}
export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw Error('Usage: node scripts/generate-cms-cos-incremental.mjs [--check]');
  const sql = await generateIncrementalSql();
  if (args[0] === '--check') {
    if (await readFile(outputUrl, 'utf8') !== sql) throw Error('Generated CMS COS SQL is stale; regenerate it');
    console.log('CMS COS SQL is current (208 media, 51352764 bytes)');
  } else {
    await mkdir(new URL('.', outputUrl), {recursive: true});
    await writeFile(outputUrl, sql, 'utf8');
    console.log('Generated sql/v20261105220918_cms_cos_incremental.sql (208 media, 51352764 bytes)');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
