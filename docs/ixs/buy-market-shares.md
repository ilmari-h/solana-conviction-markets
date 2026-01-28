# buy_market_shares

Purchases market shares for a selected option using encrypted inputs.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | The user buying shares |
| `market` | Account | The ConvictionMarket (must be open, no winner selected) |
| `user_vta` | Account | The user's VoteTokenAccount |
| `share_account` | Mutable | The user's ShareAccount for this market |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE account |
| `mempool_account` | Mutable | Arcium mempool |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `buy_conviction_market_shares` circuit |
| `cluster_account` | Mutable | Arcium cluster account |
| `pool_account` | Mutable | Arcium fee pool |
| `clock_account` | Mutable | Arcium clock |
| `system_program` | Program | Solana System Program |
| `arcium_program` | Program | Arcium Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `computation_offset` | `u64` | Unique offset for the MPC computation |
| `amount_ciphertext` | `[u8; 32]` | Encrypted share amount to purchase |
| `selected_option_ciphertext` | `[u8; 32]` | Encrypted option index to vote for |
| `user_pubkey` | `[u8; 32]` | User's x25519 public key |
| `input_nonce` | `u128` | Nonce used for input encryption |
| `authorized_reader_pubkey` | `[u8; 32]` | x25519 public key that can read the disclosure (typically market creator) |
| `authorized_reader_nonce` | `u128` | Nonce for disclosure encryption |

## Description

The core staking instruction. Users submit **encrypted** share purchases - neither the amount nor the selected option is visible on-chain. Must be called during the staking period (`open_timestamp` to `open_timestamp + time_to_stake`). Records `bought_at_timestamp` for conviction scoring.

## Encrypted Circuit: `buy_conviction_market_shares`

Decrypts inputs, validates user has sufficient vote tokens and market has sufficient shares, then deducts from both balances. Stores encrypted position in share account and creates a disclosure copy encrypted for the authorized reader (decision maker).

## Events

Emits `SharesPurchasedEvent`:
- `buyer`: User's public key
- `encrypted_disclosed_amount`: Disclosure ciphertext
- `nonce`: Disclosure nonce
