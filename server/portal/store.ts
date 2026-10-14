// MySQL is the sole runtime. A foreign driver is an error, never a fallback.
export const databaseDriver = process.env.PORTAL_DATABASE_DRIVER || "mysql";
if (databaseDriver !== "mysql") throw Error("Only MySQL is supported");
export {
  pool,
  connection,
  tx,
  id,
  event,
  initialize,
} from "../../cloud/mysql/runtime.mjs";
export const databaseConfigured = () => !!process.env.MYSQL_TRIAL_URL;
