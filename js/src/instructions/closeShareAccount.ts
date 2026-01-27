import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveShareAccountPda, deriveOptionPda } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for closing a share account
 */
export interface CloseShareAccountParams {
  /** Share account owner */
  owner: PublicKey;
  /** Market PDA */
  market: PublicKey;
  /** Revealed option index */
  optionIndex: number;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building close share account transaction
 */
export interface CloseShareAccountResult {
  /** Transaction to sign and send */
  transaction: Transaction;
}

/**
 * Builds a transaction to close a share account after the reveal period ends
 *
 * Only callable if shares were revealed and match the option_index.
 * If the user voted for the winning option and incremented the tally,
 * transfers proportional yield: (user_score / total_score) * reward_lamports.
 * Closes the account and returns rent lamports to owner.
 *
 * @param provider - Anchor provider for connection
 * @param params - Close share account parameters
 * @returns Transaction to sign and send
 */
export async function closeShareAccount(
  provider: AnchorProvider,
  params: CloseShareAccountParams
): Promise<CloseShareAccountResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const transaction = await program.methods
    .closeShareAccount(params.optionIndex)
    .accountsPartial({
      market: params.market,
    })
    .transaction();

  return { transaction };
}
