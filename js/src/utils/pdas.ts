import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  CONVICTION_MARKET_SEED,
  VOTE_TOKEN_ACCOUNT_SEED,
  SHARE_ACCOUNT_SEED,
  OPTION_SEED,
} from "../constants";

/**
 * Derives the PDA for a Conviction Market account
 *
 * @param creator - Market creator's public key
 * @param index - Unique market index
 * @param programId - Optional program ID (defaults to PROGRAM_ID)
 * @returns Tuple of [PublicKey, bump]
 */
export function deriveMarketPda(
  creator: PublicKey,
  index: BN | number,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const indexBN = typeof index === "number" ? new BN(index) : index;

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(CONVICTION_MARKET_SEED),
      creator.toBuffer(),
      indexBN.toArrayLike(Buffer, "le", 8), // u64 = 8 bytes
    ],
    programId
  );
}

/**
 * Derives the PDA for a Vote Token Account
 *
 * @param owner - Account owner's public key
 * @param programId - Optional program ID (defaults to PROGRAM_ID)
 * @returns Tuple of [PublicKey, bump]
 */
export function deriveVoteTokenAccountPda(
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VOTE_TOKEN_ACCOUNT_SEED), owner.toBuffer()],
    programId
  );
}

/**
 * Derives the PDA for a Share Account
 *
 * @param owner - Account owner's public key
 * @param market - Market PDA
 * @param programId - Optional program ID (defaults to PROGRAM_ID)
 * @returns Tuple of [PublicKey, bump]
 */
export function deriveShareAccountPda(
  owner: PublicKey,
  market: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SHARE_ACCOUNT_SEED), owner.toBuffer(), market.toBuffer()],
    programId
  );
}

/**
 * Derives the PDA for a Market Option
 *
 * @param market - Market PDA
 * @param optionIndex - Option index (1-based)
 * @param programId - Optional program ID (defaults to PROGRAM_ID)
 * @returns Tuple of [PublicKey, bump]
 */
export function deriveOptionPda(
  market: PublicKey,
  optionIndex: number,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const optionIndexBN = new BN(optionIndex);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(OPTION_SEED),
      market.toBuffer(),
      optionIndexBN.toArrayLike(Buffer, "le", 2), // u16 = 2 bytes
    ],
    programId
  );
}
