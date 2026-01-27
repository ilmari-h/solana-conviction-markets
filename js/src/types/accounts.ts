/**
 * Account types are now inferred from the Anchor program and exported from utils/accounts.ts
 *
 * Use the following exports:
 * - VoteTokenAccountData
 * - ShareAccountData
 * - ConvictionMarketAccount
 * - ConvictionMarketOptionData
 * - DecryptedVoteTokenBalance
 * - DecryptedShareAccount
 * - DecryptedMarketShares
 *
 * All imported from: @bench.games/conviction-markets (utils/accounts module)
 */

// Re-export account types from utils for convenience
export type {
  VoteTokenAccountData,
  ShareAccountData,
  ConvictionMarketAccount,
  ConvictionMarketOptionData,
  DecryptedVoteTokenBalance,
  DecryptedShareAccount,
  DecryptedMarketShares,
} from "../utils/accounts";
