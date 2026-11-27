import {createPrivateFile} from '../server/privateFile.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
import {environmentName, portalEnvironmentKey, readEnvironment} from '../server/environment.mjs';

/** Keep the target file intact and append only assignments absent from it. */
export function prepareEnvironment(target, {
  directory = process.cwd(),
  templateDirectory = process.cwd(),
  create = false,
} = {}) {
  const name = environmentName(target);
  const file = path.resolve(directory, '.env.' + name);
  const template = fs.readFileSync(path.resolve(templateDirectory, '.env.' + name + '.example'), 'utf8');
  const defaults = dotenv.parse(template);
  if ((defaults.UPER_PORTAL_ENV ?? defaults.PORTAL_ENV) !== name) throw Error('Environment template target mismatch');

  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!create) throw Error('Missing .env.' + name + '; run npm run env:prepare -- ' + name);
    createPrivateFile(file, template);
    return {created: true, added: Object.keys(defaults)};
  }
  if (!stat.isFile()) throw Error('Environment configuration must be a regular file');

  const original = fs.readFileSync(file);
  readEnvironment(name, directory);
  const existing = dotenv.parse(original);
  const existingKeys = new Set(Object.keys(existing).map(portalEnvironmentKey));
  const added = Object.keys(defaults).filter(key => !existingKeys.has(portalEnvironmentKey(key)));
  if (added.length === 0) return {created: false, added};

  const entries = added.map(key => key + '=' + JSON.stringify(defaults[key])).join('\n');
  const addition = '\n# Settings added from the environment template\n' + entries + '\n';
  const merged = dotenv.parse(Buffer.concat([original, Buffer.from(addition)]));
  if (Object.entries(existing).some(([key, value]) => merged[key] !== value) ||
      added.some(key => merged[key] !== defaults[key])) {
    throw Error('Cannot safely append environment settings');
  }

  // Append through the validated file descriptor. Never truncate an existing file.
  const fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
  try {
    const current = fs.fstatSync(fd);
    if (current.ino !== stat.ino || current.dev !== stat.dev || !fs.readFileSync(fd).equals(original))
      throw Error('Environment file changed during preparation; retry');
    fs.writeFileSync(fd, addition);
  } finally {
    fs.closeSync(fd);
  }
  return {created: false, added};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [target, directory] = process.argv.slice(2);
  if (!target) throw Error('Usage: npm run env:prepare -- <dev|test|prod> [configuration-directory]');
  const result = prepareEnvironment(target, {directory, create: true});
  console.log(JSON.stringify({environment: target, ...result}));
}
