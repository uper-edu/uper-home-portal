import {buildPortalPackage} from './package-portal.mjs';
await buildPortalPackage({environment:process.argv[2]||'dev'});
