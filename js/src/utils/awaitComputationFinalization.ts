import { BN, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { awaitComputationFinalization as arciumAwait } from "@arcium-hq/client";
import { PROGRAM_ID } from "../constants";

/**
 * Options for awaiting computation finalization
 */
export interface AwaitComputationOptions {
  /** Commitment level (default: "confirmed") */
  commitment?: "confirmed" | "finalized";
  /** Program ID (default: PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Awaits the finalization of an MPC computation
 *
 * After sending an instruction that triggers an MPC computation,
 * call this function with the returned computation offset to wait
 * for the computation to complete.
 *
 * @param provider - Anchor provider for connection
 * @param computationOffset - The offset returned from the MPC instruction
 * @param options - Optional configuration
 * @returns Promise resolving to the computation result transaction signature
 *
 * @example
 * ```typescript
 * const { signature, computationOffset } = await mintVoteTokens(provider, {
 *   signer: user,
 *   userX25519Keypair,
 *   amount: 100,
 * });
 *
 * // Wait for MPC computation to complete
 * await awaitComputationFinalization(provider, computationOffset);
 * ```
 */
export async function awaitComputationFinalization(
  provider: AnchorProvider,
  computationOffset: BN,
  options?: AwaitComputationOptions
): Promise<string> {
  const commitment = options?.commitment ?? "confirmed";
  const programId = options?.programId ?? PROGRAM_ID;

  return await arciumAwait(provider, computationOffset, programId, commitment);
}
