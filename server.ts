import {loadPortalEnvironment} from './server/environment.mjs';
import {companyConfiguration} from './server/companyTrial.ts';
loadPortalEnvironment();
if (process.env.PORTAL_DATABASE_DRIVER !== "mysql")
  throw Error("Explicit MySQL configuration required; no database fallback");
companyConfiguration();
const { startMysqlApplication } = await import("./server/mysqlApplication.ts");
await startMysqlApplication();
