import {loadPortalEnvironment} from './server/environment.mjs';
import {companyConfiguration} from './server/companyTrial.ts';
import {log} from './server/logger.ts';
import {createRuntimeVersion} from './server/runtimeVersion.mjs';
// Crash semantics stay the same as Node's default; these handlers only add a clean log line first.
// setImmediate yields one turn so the line reaches the pipe before exit on async-write platforms.
process.on('uncaughtException',(e)=>{log.error('process.uncaught_exception',{error:e});setImmediate(()=>process.exit(1));});
process.on('unhandledRejection',(e)=>{log.error('process.unhandled_rejection',{error:e});setImmediate(()=>process.exit(1));});
loadPortalEnvironment();
if (process.env.PORTAL_DATABASE_DRIVER !== "mysql")
  throw Error("Explicit MySQL configuration required; no database fallback");
const runtimeVersion=createRuntimeVersion();
companyConfiguration();
const { startMysqlApplication } = await import("./server/mysqlApplication.ts");
await startMysqlApplication(runtimeVersion);
