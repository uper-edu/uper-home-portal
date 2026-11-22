import fs from 'node:fs/promises';
import path from 'node:path';

const schemaName = /^schema(?:-[\w-]+)?\.sql$/;

export async function readStartupMigrationSqlNames(sourceDirectory) {
  const migration = await fs.readFile(path.join(sourceDirectory, 'migrate.mjs'), 'utf8');
  const required = new Set(
    Array.from(migration.matchAll(/['"](?:\.\/)?(schema(?:-[\w-]+)?\.sql)['"]/g), match => match[1]),
  );
  if (!required.size) throw new Error('No startup migration SQL files found');
  return required;
}

export async function verifyPackagedMigrationSql(sourceDirectory, packagedDirectory) {
  const required = await readStartupMigrationSqlNames(sourceDirectory);
  const packaged = new Set((await fs.readdir(packagedDirectory)).filter(name => schemaName.test(name)));
  const missing = [...required].filter(name => !packaged.has(name));
  const extra = [...packaged].filter(name => !required.has(name));
  if (missing.length || extra.length) {
    throw new Error(`Migration SQL package differs from startup references. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`);
  }
  for (const name of required) {
    const [source, copy] = await Promise.all([
      fs.readFile(path.join(sourceDirectory, name)),
      fs.readFile(path.join(packagedDirectory, name)),
    ]);
    if (!source.equals(copy)) throw new Error(`Packaged migration SQL differs from source: ${name}`);
  }
}
