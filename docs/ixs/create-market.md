# create_market

Creates a new Conviction Market with encrypted available shares.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `creator` | Signer, Mutable | The market creator who pays for account creation |
| `market` | PDA, Init | The ConvictionMarket account to be created |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE (Multi-party eXecution Environment) account |
| `mempool_account` | Mutable | Arcium mempool for queuing computations |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `init_market_shares` circuit |
| `cluster_account` | Mutable | Arcium cluster account |
| `pool_account` | Mutable | Arcium fee pool |
| `clock_account` | Mutable | Arcium clock |
| `system_program` | Program | Solana System Program |
| `arcium_program` | Program | Arcium Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `market_index` | `u64` | Unique index for the market (used in PDA derivation) |
| `computation_offset` | `u64` | Unique offset for the MPC computation |
| `max_options` | `u16` | Maximum number of voting options allowed |
| `max_shares` | `u64` | Total shares available for purchase |
| `reward_lamports` | `u64` | Amount of SOL reward to distribute to winners |
| `time_to_stake` | `u64` | Duration in seconds for the staking period |
| `time_to_reveal` | `u64` | Duration in seconds for the reveal period |
| `nonce` | `u128` | Random nonce for encryption |
| `select_authority` | `Option<Pubkey>` | Optional alternative authority that can select the winning option |

## Description

This instruction initializes a new Conviction Market. The creator specifies the market parameters including how many options can be added, how many shares are available, the reward pool size, and timing windows.

## Encrypted Circuit: `init_market_shares`

This instruction invokes the `init_market_shares` MPC circuit to initialize the market's encrypted available shares.

## Events

Emits `MarketCreatedEvent`:
- `market`: Market PDA
- `creator`: Creator's public key
- `max_shares`: Total available shares
- `index`: Market index
