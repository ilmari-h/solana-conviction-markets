import { RescueCipher, x25519 } from "@arcium-hq/client";
import { createHash } from "crypto";

export interface X25519Keypair {
  cipher: RescueCipher,
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}


/**
 * Generates a new X25519 keypair.
 * Used for encrypted computations with Arcium.
 *
 * @returns A new X25519Keypair with publicKey and secretKey
 */
export function generateX25519Keypair(): X25519Keypair {
  const secretKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(secretKey);

  return {
    publicKey,
    secretKey,
    cipher: new RescueCipher(secretKey)
  };
}

/**
 * Derives an X25519 keypair deterministically from a signature
 * @param signature - Signature bytes to derive the keypair from
 * @returns A deterministic X25519Keypair derived from the signature
 */
export function deriveX25519KeypairFromSignature(
  signature: Uint8Array
): X25519Keypair {
  const secretKey = new Uint8Array(createHash("sha256").update(signature).digest());
  const publicKey = x25519.getPublicKey(secretKey);
  return { secretKey, publicKey, cipher: new RescueCipher(secretKey) };
}