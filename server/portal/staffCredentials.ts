import {createHash,randomBytes,scrypt as derive} from "node:crypto";
import {promisify} from "node:util";

export const scrypt = promisify(derive);

export async function hashPassword(password:string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password,salt,64)) as Buffer;
  return salt+":"+key.toString("hex");
}

export const passwordChangeKey = (id:string) =>
  "pw:"+createHash("sha256").update(id).digest("hex").slice(0,29);
