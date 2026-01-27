import { randomBytes } from "crypto";
import { BN } from "@coral-xyz/anchor";
import { deserializeLE } from "@arcium-hq/client";

/**
 * Generates a random computation offset for MPC operations
 *
 * Each MPC instruction requires a unique offset to identify the computation.
 * This function generates a random 8-byte value.
 *
 * @returns A random BN to use as computation offset
 */
export function generateComputationOffset(): BN {
  return new BN(randomBytes(8), "hex");
}

/**
 * Generates a random nonce for encryption
 *
 * Nonces are used to ensure encryption produces different ciphertexts
 * for the same plaintext.
 *
 * @returns A random 16-byte Uint8Array
 */
export function generateNonce(): Uint8Array {
  return randomBytes(16);
}

/**
 * Converts a nonce to a u128 BN for passing to instructions
 *
 * @param nonce - 16-byte nonce
 * @returns BN representation of the nonce
 */
export function nonceToU128(nonce: Uint8Array): BN {
  return new BN(deserializeLE(nonce).toString());
}
