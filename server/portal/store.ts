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
export const tx = (work: (client: any) => any, options?: {isolation?: 'READ COMMITTED'}) => {
  const client = operationContext.getStore();
  if(client && options?.isolation && client.transactionIsolation!==options.isolation)
    throw Error('Notification planning requires a new READ COMMITTED transaction');
  return client ? work(client) : nativeTransaction(work, options);
};
export const pool = {
  ...nativePool,
  query: (...args: any[]) => {
    const client = operationContext.getStore();
    return client ? client.query(...args) : nativePool.query(args[0],args[1]);
  },
};
export const databaseConfigured = () => !!process.env.MYSQL_TRIAL_URL;
