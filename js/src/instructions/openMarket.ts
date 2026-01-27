import { Program, BN, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for opening a market
 */
export interface OpenMarketParams {
  /** Market creator (must be the original creator) */
  creator: PublicKey;
  /** Market PDA to open */
  market: PublicKey;
  /** Unix timestamp when market opens for trading */
  openTimestamp: number | BN;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building open market transaction
 */
export interface OpenMarketResult {
  /** Transaction to sign and send */
  transaction: Transaction;
}

/**
 * Builds a transaction to open a market for trading
 *
 * After creating a market and adding options, the creator must open it
 * with a specific timestamp. The market must be funded before opening.
 *
 * @param provider - Anchor provider for connection
 * @param params - Open market parameters
 * @returns Transaction to sign and send
 */
export async function openMarket(
  provider: AnchorProvider,
  params: OpenMarketParams
): Promise<OpenMarketResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const openTimestampBN =
    typeof params.openTimestamp === "number"
      ? new BN(params.openTimestamp)
      : params.openTimestamp;

  const transaction = await program.methods
    .openMarket(openTimestampBN)
    .accountsPartial({
      market: params.market,
    })
    .transaction();

  return { transaction };
}
