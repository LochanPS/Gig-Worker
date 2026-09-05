// Hashing helpers. These MUST agree with the chain: the credential hash stored in
// the DB is the value a verifier matches against the IdentityRegistry record, and
// the compliance hash is passed into EscrowVault.fund(). Ethereum's keccak256 is
// NOT SHA3-256 (different padding), so use viem's implementation rather than
// node:crypto's 'sha3-256' — the two produce different digests for the same input.
import { keccak256 as viemKeccak256, toBytes } from 'viem';

export function toUtf8(s: string): Buffer {
  return Buffer.from(s, 'utf8');
}

export function keccak256(data: Buffer | string): string {
  return viemKeccak256(typeof data === 'string' ? toBytes(data) : new Uint8Array(data));
}
