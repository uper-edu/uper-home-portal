import { pool } from "../server/portal/store.ts";
import { backupPortal, restorePortal } from "../server/portal/backup.ts";
const [mode, file] = process.argv.slice(2);
if (!["backup", "restore"].includes(mode) || !file || !process.env.DATABASE_URL)
  throw Error(
    "Usage: DATABASE_URL=... node --import tsx scripts/portal-backup.ts backup|restore /absolute/path.json",
  );
try {
  console.log(
    JSON.stringify(
      await (mode === "backup" ? backupPortal(file) : restorePortal(file)),
    ),
  );
} finally {
  await pool.end();
}
