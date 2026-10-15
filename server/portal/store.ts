// MySQL is the sole runtime. A foreign driver is an error, never a fallback.
export const databaseDriver = process.env.PORTAL_DATABASE_DRIVER || "mysql";
if (databaseDriver !== "mysql") throw Error("Only MySQL is supported");
export {
  connection,
  id,
  event,
  initialize,
} from "../../cloud/mysql/runtime.mjs";
import { tx as nativeTransaction, pool as nativePool } from "../../cloud/mysql/runtime.mjs";
import { operationContext } from "./operationContext.ts";
export const tx = (work: (client: any) => any) => {
  const client = operationContext.getStore();
  return client ? work(client) : nativeTransaction(work);
};
export const pool = {
  ...nativePool,
  query: (...args: any[]) => {
    const client = operationContext.getStore();
    return client ? client.query(...args) : nativePool.query(args[0],args[1]);
  },
};
export const databaseConfigured = () => !!process.env.MYSQL_TRIAL_URL;
