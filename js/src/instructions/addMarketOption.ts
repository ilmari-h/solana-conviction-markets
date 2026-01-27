import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram, type Keypair, type PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveOptionPda } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for adding a market option
 */
export interface AddMarketOptionParams {
  /** Market creator (must be the original creator) */
  creator: Keypair;
  /** Market PDA to add option to */
  market: PublicKey;
  /** Option index (1-based, must be sequential) */
  optionIndex: number;
  /** Human-readable name for the option (max 50 characters) */
  name: string;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from adding a market option
 */
export interface AddMarketOptionResult {
  /** Transaction signature */
  signature: string;
  /** PDA of the created option account */
  optionPda: PublicKey;
}

/**
 * Adds a named option to a market
 *
 * Options must be added before opening the market. Option indices
 * must be sequential starting from 1.
 *
 * @param provider - Anchor provider for connection and wallet
 * @param params - Add market option parameters
 * @returns Transaction signature and option PDA
 */
export async function addMarketOption(
  provider: AnchorProvider,
  params: AddMarketOptionParams
): Promise<AddMarketOptionResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const [optionPda] = deriveOptionPda(
    params.market,
    params.optionIndex,
    programId
  );

  const signature = await program.methods
    .addMarketOption(params.optionIndex, params.name)
    .accountsPartial({
      market: params.market,
      systemProgram: SystemProgram.programId,
    })
    .signers([params.creator])
    .rpc();

  return { signature, optionPda };
}
