import { backup, restore, fingerprints } from "../../cloud/mysql/backup.mjs";
export const backupPortal = (file: string) => backup(process.env, file);
export const restorePortal = (file: string, sha256: string) =>
  restore(process.env, file, sha256);
export { fingerprints };
