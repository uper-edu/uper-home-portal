import { backupPortal, restorePortal } from "../server/portal/backup.ts";
const [mode, file, checksum] = process.argv.slice(2);
if (
  !["backup", "restore"].includes(mode) ||
  !file ||
  !process.env.MYSQL_TRIAL_URL
)
  throw Error(
    "Usage: MYSQL_TRIAL_URL=... MYSQL_BIN_DIRECTORY=... portal-backup.ts backup|restore /absolute/path.sql [sha256]",
  );
console.log(
  JSON.stringify(
    await (mode === "backup"
      ? backupPortal(file)
      : restorePortal(file, checksum)),
  ),
);
