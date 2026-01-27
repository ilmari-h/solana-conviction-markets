import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveOptionPda } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for selecting the winning option
 */
export interface SelectOptionParams {
  /** Authority (creator or select_authority) */
  authority: PublicKey;
  /** Market PDA */
  market: PublicKey;
  /** Winning option index */
  optionIndex: number;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building select option transaction
 */
export interface SelectOptionResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the selected option */
  optionPda: PublicKey;
}

/**
 * Builds a transaction to select the winning option for a market
 *
 * Can be called by the market creator or designated select_authority.
 * Automatically closes the staking period if still open.
 *
 * @param provider - Anchor provider for connection
 * @param params - Select option parameters
 * @returns Transaction to sign and send, and option PDA
 */
export async function selectOption(
  provider: AnchorProvider,
  params: SelectOptionParams
): Promise<SelectOptionResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const transaction = await program.methods
    .selectOption(params.optionIndex)
    .accountsPartial({
      market: params.market,
    })
    .transaction();

  const [optionPda] = deriveOptionPda(
    params.market,
    params.optionIndex,
    programId
  );

  return { transaction, optionPda };
}
