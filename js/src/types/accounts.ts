import type { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

/**
 * Conviction Market account structure
 *
 * Represents a prediction/voting market where users can stake capital
 * on their preferred option with encrypted votes.
 */
export interface ConvictionMarketAccount {
  /** Encrypted available shares state */
  encryptedAvailableShares: Uint8Array[][];
  /** PDA bump seed */
  bump: number;
  /** Market creator's public key */
  creator: PublicKey;
  /** Unique market index */
  index: BN;
  /** Current number of options added */
  totalOptions: number;
  /** Maximum number of options allowed */
  maxOptions: number;
  /** Timestamp when market opens for trading */
  openTimestamp?: BN;
  /** Duration of staking period in seconds */
  timeToStake: BN;
  /** Duration of reveal period in seconds */
  timeToReveal: BN;
  /** Selected winning option (if set) */
  selectedOption?: number;
  /** Nonce for encrypted state */
  stateNonce: BN;
  /** Maximum shares available for purchase */
  maxShares: BN;
  /** Reward pool in lamports for winners */
  rewardLamports: BN;
  /** Optional authority that can select winning option */
  selectAuthority?: PublicKey;
}

/**
 * Vote Token Account structure
 *
 * Holds a user's encrypted vote token balance.
 * Vote tokens are used to purchase market shares.
 */
export interface VoteTokenAccountData {
  /** Encrypted token balance state */
  encryptedState: Uint8Array[][];
  /** PDA bump seed */
  bump: number;
  /** Account owner's public key */
  owner: PublicKey;
  /** Nonce for encrypted state */
  stateNonce: BN;
}

/**
 * Share Account structure
 *
 * Represents a user's encrypted position in a specific market,
 * including the amount of shares and selected option.
 */
export interface ShareAccountData {
  /** Encrypted state: [share_amount, selected_option] */
  encryptedState: Uint8Array[][];
  /** Nonce for encrypted state */
  stateNonce: BN;
  /** PDA bump seed */
  bump: number;
  /** Account owner's public key */
  owner: PublicKey;
  /** Market this share account is for */
  market: PublicKey;
  /** Encrypted state disclosure for analytics */
  encryptedStateDisclosure: Uint8Array[][];
  /** Nonce for disclosure state */
  stateNonceDisclosure: BN;
  /** Timestamp when shares were purchased */
  boughtAtTimestamp: BN;
  /** Revealed share amount (after reveal) */
  revealedAmount?: BN;
  /** Revealed option choice (after reveal) */
  revealedOption?: number;
  /** Conviction score (amount * time-in-market) */
  revealedScore?: BN;
  /** Whether tally has been incremented for this share */
  totalIncremented: boolean;
}

/**
 * Market Option structure
 *
 * Represents a named voting option in a market.
 */
export interface ConvictionMarketOptionData {
  /** PDA bump seed */
  bump: number;
  /** Market creator's public key */
  creator: PublicKey;
  /** Human-readable name of the option */
  name: string;
  /** Total shares bought for this option */
  totalShares?: BN;
  /** Total conviction score for this option */
  totalScore?: BN;
}
