// Hashing + AES-256-GCM helpers. Credential JSON is encrypted at rest; only
// the keccak-style hash is anchored on-chain (GDPR: no PII on-chain).
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { config } from "./config.js";

/** Deterministic sha256 hex digest, prefixed 0x for on-chain parity. */
export function hash0x(input: string): string {
  return "0x" + createHash("sha256").update(input).digest("hex");
}

/** keccak-style escrow id derived from a uuid (mirrors keccak256(uuid)). */
export function escrowIdFromUuid(uuid: string): string {
  return hash0x(`escrow:${uuid}`);
}

const encKey = Buffer.from(config.credentialEncKey, "hex");

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encKey, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
