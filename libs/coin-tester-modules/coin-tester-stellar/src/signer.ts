import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "crypto";
import { StrKey } from "@stellar/stellar-sdk";

/**
 * In-process Stellar test signer, exported as the three functions the
 * framework actually calls.  The scenario imports this module with
 * `import * as signer` so the namespace object satisfies the
 * SignerContext callback contract (which expects `signer.getPublicKey`,
 * `signer.getAddress`, `signer.signTransaction` as properties).
 *
 * Key derivation deliberately skips SLIP-10: 32 fresh random bytes become
 * the Ed25519 private key. The address only needs to be a valid Stellar
 * account and the signature needs to verify against the local Quickstart
 * node — no hardware-derivation parity is required for that.
 *
 * One key per process. Re-importing inside the same process keeps the same
 * keypair; spawning a new test process generates a fresh one.
 */
const privateKey = Uint8Array.from(randomBytes(32));
const rawPublicKey = Buffer.from(ed25519.getPublicKey(privateKey));

export const address = StrKey.encodeEd25519PublicKey(rawPublicKey);

export async function getPublicKey(
  _path: string,
  _display?: boolean,
): Promise<{ rawPublicKey: Buffer }> {
  return { rawPublicKey };
}

export async function getAddress(
  path: string,
  _options?: { verify?: boolean; derivationMode?: string },
): Promise<{ path: string; address: string; publicKey: string }> {
  // `combine` passes this `publicKey` straight to `Transaction.addSignature`,
  // which expects a Stellar-encoded G... account id (not a raw hex string).
  return { path, address, publicKey: address };
}

export async function signTransaction(
  _path: string,
  transaction: string,
  _options?: { derivationMode?: string },
): Promise<string> {
  /**
   * `transaction` is the base64-encoded TransactionSignaturePayload XDR
   * (returned by coin-stellar's `craftTransaction` via `signatureBase`).
   * Stellar tx hash = SHA256(signatureBase); the hardware device computes
   * that hash internally before signing. We mirror that here so the
   * resulting signature lines up with what `combine()` will verify against
   * `Transaction.hash()`.
   */
  const payload = Buffer.from(transaction, "base64");
  const hash = sha256(payload);
  const signature = ed25519.sign(hash, privateKey);
  return Buffer.from(signature).toString("base64");
}
