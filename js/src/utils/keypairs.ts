import { Keypair } from "@solana/web3.js";
import { x25519 } from "@arcium-hq/client";
import type { X25519Keypair } from "../types";
import { randomBytes, createHash } from "crypto";

/**
 * Generates a new Solana keypair
 *
 * Used for transaction signing and account ownership
 *
 * @returns A new Solana Keypair
 */
export function generateSolanaKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Generates a new X25519 keypair for MPC encryption
 *
 * Used for encrypted computations with Arcium.
 * The keypair is used to derive a shared secret with the MXE.
 *
 * @returns A new X25519Keypair with publicKey and secretKey
 */
export function generateX25519Keypair(): X25519Keypair {
  const secretKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(secretKey);

  return {
    publicKey,
    secretKey,
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
  return { secretKey, publicKey };
}
