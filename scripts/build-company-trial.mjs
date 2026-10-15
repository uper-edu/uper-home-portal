import {buildPortalPackage} from './package-portal.mjs';
await buildPortalPackage({environment:'test',directory:process.argv[2]||'.local-backups/company-trial-20261014/package'});
