import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveShareAccountPda, deriveOptionPda } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for incrementing option tally
 */
export interface IncrementOptionTallyParams {
  /** Market PDA */
  market: PublicKey;
  /** Share account owner */
  owner: PublicKey;
  /** Option index to increment */
  optionIndex: number;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building increment option tally transaction
 */
export interface IncrementOptionTallyResult {
  /** Transaction to sign and send */
  transaction: Transaction;
}

/**
 * Builds a transaction to increment the tally for an option after shares are revealed
 *
 * This is permissionless - anyone can call it for any revealed share account.
 * Calculates conviction score (amount * time-in-market) and adds it to the
 * option's total. Each share account can only increment once.
 *
 * @param provider - Anchor provider for connection
 * @param params - Increment option tally parameters
 * @returns Transaction to sign and send
 */
export async function incrementOptionTally(
  provider: AnchorProvider,
  params: IncrementOptionTallyParams
): Promise<IncrementOptionTallyResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const transaction = await program.methods
    .incrementOptionTally(params.optionIndex)
    .accountsPartial({
      market: params.market,
      owner: params.owner,
    })
    .transaction();

  return { transaction };
}
