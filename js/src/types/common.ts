import type { BN } from "@coral-xyz/anchor";

/**
 * X25519 keypair for MPC encryption
 * Used for encrypted computations with Arcium
 */
export interface X25519Keypair {
  /** Public key (32 bytes) */
  publicKey: Uint8Array;
  /** Secret/private key (32 bytes) */
  secretKey: Uint8Array;
}

/**
 * Result from an MPC computation
 */
export interface ComputationResult {
  /** Transaction signature */
  signature: string;
  /** Unique computation offset used */
  offset: BN;
}
