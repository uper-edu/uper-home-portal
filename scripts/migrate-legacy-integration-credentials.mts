import {runCredentialMaintenance} from './lib/credential-maintenance.mts';

try {
  const {report, blocked} = await runCredentialMaintenance('migrate', process.argv.slice(2));
  console.log(JSON.stringify(report));
  if (blocked) process.exitCode = 1;
} catch {
  process.exitCode = 1;
  console.error('Credential migration did not complete. Specify --environment dev, test or prod and check the database and keyring.');
}
