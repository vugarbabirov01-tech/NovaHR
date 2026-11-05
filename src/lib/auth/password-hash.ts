// Password hashing — Node's built-in `crypto.scrypt`, deliberately no new
// dependency (no bcrypt/argon2 package is installed in this project).
// scrypt is a standard, memory-hard KDF suitable for password storage;
// Node ships it natively, so this needs nothing added to package.json.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/** Format: "scrypt:<saltHex>:<hashHex>" — the algorithm name is embedded
 * so a future change of KDF never breaks reading an old hash; it just
 * means hashPassword must branch on it (not needed yet, only one scheme
 * exists). */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`
}

export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = storedHash.split(":")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, "hex")
  const expected = Buffer.from(hashHex, "hex")
  const derived = (await scrypt(plainPassword, salt, expected.length)) as Buffer

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
