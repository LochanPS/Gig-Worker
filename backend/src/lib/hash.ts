// Small hashing helpers. keccak256 here is a stand-in using sha3-256 semantics
// via Node's crypto where available; P1's viem utils are authoritative on-chain.
// For the backend we only need a stable 32-byte hex the contract can store.
import { createHash } from 'node:crypto';

export function toUtf8(s: string): Buffer {
  return Buffer.from(s, 'utf8');
}

// Node exposes sha3-256 through OpenSSL; fall back to sha256 if unavailable.
export function keccak256(data: Buffer): string {
  try {
    return '0x' + createHash('sha3-256').update(data).digest('hex');
  } catch {
    return '0x' + createHash('sha256').update(data).digest('hex');
  }
}
