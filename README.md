# Conviction Market

Private voting market on Solana using Arcium MPC for encrypted vote storage and processing.

Users buy vote tokens, then allocate them to market options. Both balances and vote allocations are encrypted on-chain - only the final outcome is revealed.

## Build & Test

```bash
yarn install
arcium build
arcium test
```

## Structure

- `programs/conviction_market/` - Anchor program
- `encrypted-ixs/` - MPC circuits (Arcis)
- `tests/` - Integration tests

## Accounts

| Account | Purpose |
|---------|---------|
| `ConvictionMarket` | Market config, encrypted available shares |
| `ConvictionMarketOption` | Named voting option |
| `VoteTokenAccount` | User's encrypted token balance |
| `ConvictionMarketShare` | User's encrypted position (shares + option) |

## Flow

1. Create market with max options, total shares, time windows
2. Add named options
3. Fund market with SOL, set open timestamp
4. Users mint vote tokens (SOL → encrypted balance)
5. Users buy shares with encrypted inputs (amount + selected option)

## MPC Circuits

- `init_vote_token_account` - Initialize user balance to 0
- `calculate_vote_token_balance` - Buy/sell vote tokens
- `init_market_shares` - Initialize market's available shares
- `buy_conviction_market_shares` - Purchase shares, deduct from user and market balances
