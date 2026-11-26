import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse identical JSON fragments across the immutable archives. Parse a separate
// document on first use of each version so the browser gets the same objects and key order.
export function emitHskArchives(archives) {
  const fragments = new Map();
  const literal = JSON.stringify;
  function intern(value) {
    const json = literal(value);
    if (!fragments.has(json)) fragments.set(json, `part${fragments.size}`);
    return fragments.get(json);
  }
  function object(value, renderValue) {
    return [literal('{'), ...Object.entries(value).flatMap(([key, entry], index) => [
      literal(`${index ? ',' : ''}${literal(key)}:`), ...renderValue(key, entry),
    ]), literal('}')];
  }
  const fields = (_key, value) => [intern(value)];
  const fragmentsByArchive = Object.entries(archives).map(([name, archive]) => {
    const parts = object(archive, (key, value) => key !== 'questions' ? fields(key, value) : [
      literal('['), ...value.flatMap((question, index) => [
        ...(index ? [literal(',')] : []), ...object(question, fields),
      ]), literal(']'),
    ]);
    return `get ${literal(name)}() {
      const archive = JSON.parse([${parts.join(',')}].join(''));
      Object.defineProperty(this, ${literal(name)}, {value: archive, enumerable: true});
      return archive;
    }`;
  });
  const declarations = Array.from(fragments, ([json, name]) => `const ${name} = ${literal(json)};`);
  return `${declarations.join('\n')}\nconst archives = {${fragmentsByArchive.join(',')}};\nexport default archives;`;
}

const archiveImporter = fileURLToPath(new URL('../../src/data/hskVersionArchives.ts', import.meta.url));
const archiveDirectory = resolve(dirname(archiveImporter), 'hskVersions');
const viteArchiveImporter = archiveImporter.split(sep).join('/');
const archiveFilename = /^[a-z0-9-]+\.json$/;

/** @returns {import('vite').Plugin} */
export function hskArchiveBundle() {
  return {
    name: 'uper-hsk-archive-bundle',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      if (id !== viteArchiveImporter) return null;
      this.addWatchFile(archiveDirectory);
      const archives = Object.fromEntries(readdirSync(archiveDirectory).filter(name => archiveFilename.test(name)).sort().map(name => {
        const file = resolve(archiveDirectory, name);
        this.addWatchFile(file);
        const archive = JSON.parse(readFileSync(file, 'utf8'));
        if (archive.examVersion + '.json' !== name) throw Error('Assessment archive name must match its version: '+name);
        return [archive.examVersion, archive];
      }));
      return emitHskArchives(archives) + `
        export function readHskVersionArchive(examVersion) {
          return Object.hasOwn(archives, examVersion) ? archives[examVersion] : undefined;
        }`;
    },
  };
}
