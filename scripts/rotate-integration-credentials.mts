import {runCredentialMaintenance} from './lib/credential-maintenance.mts';

try {
  const {report} = await runCredentialMaintenance('rotate', process.argv.slice(2));
  console.log(JSON.stringify(report));
} catch {
  process.exitCode = 1;
  console.error('Credential rotation did not complete. Specify --environment dev, test or prod and check the database and retained key versions.');
}
