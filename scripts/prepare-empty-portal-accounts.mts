import {resolve} from 'node:path';
import access from '../src/data/system-defaults/access.ts';
import {createPrivateFile,readPrivateFile} from '../server/privateFile.mjs';
import {hashPassword} from '../server/portal/staffCredentials.ts';

async function main() {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) {
    throw Error('Usage: node --import tsx scripts/prepare-empty-portal-accounts.mts PRIVATE_PASSWORDS.json UNUSED_PRIVATE_ACCOUNTS.sql');
  }
  let passwords: Record<string, string>;
  try {
    passwords = JSON.parse(readPrivateFile(resolve(input)).toString('utf8'));
  } catch {
    throw Error('Expected a private JSON file containing the approved staff and temporary passwords');
  }
  if (!passwords || typeof passwords !== 'object' || Array.isArray(passwords) ||
      !Object.hasOwn(passwords, 'Robert')) {
    throw Error('Expected an object of approved staff credentials including the initial administrator Robert');
  }
  const approved = new Set([...access.accounts.map(([id]) => id), 'Eric', 'Hao']);
  const values = Object.values(passwords);
  if (Object.entries(passwords).some(([id, password]) =>
      !approved.has(id) || typeof password !== 'string' ||
      password.trim().length < 16 || password.length > 200 || password.toLowerCase() === id.toLowerCase()) ||
      new Set(values).size !== values.length) {
    throw Error('Supply one distinct temporary password of 16–200 characters for each approved staff account');
  }
  const accounts = [];
  for (const id of Object.keys(passwords).sort()) {
    accounts.push({id, passwordHash: await hashPassword(passwords[id])});
  }
  const payload = Buffer.from(JSON.stringify(accounts), 'utf8').toString('hex');
  createPrivateFile(resolve(output), `SET @uper_bootstrap_accounts = CONVERT(0x${payload} USING utf8mb4);\n`);
}

main().catch(error => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
