# reveal_shares

Decrypts a user's share position and credits their vote tokens back.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | Anyone can call this (permissionless) |
| `owner` | Unchecked | The owner of the share account being revealed |
| `market` | Account | The ConvictionMarket |
| `share_account` | Mutable | The ShareAccount to reveal |
| `user_vta` | Mutable | The owner's VoteTokenAccount |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE account |
| `mempool_account` | Mutable | Arcium mempool |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `reveal_shares` circuit |
| `cluster_account` | Mutable | Arcium cluster account |
| `pool_account` | Mutable | Arcium fee pool |
| `clock_account` | Mutable | Arcium clock |
| `system_program` | Program | Solana System Program |
| `arcium_program` | Program | Arcium Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `computation_offset` | `u64` | Unique offset for the MPC computation |
| `user_pubkey` | `[u8; 32]` | Owner's x25519 public key for decryption |

## Description

Decrypts a user's share position, writing plaintext `revealed_amount` and `revealed_option` to the share account. Also credits the staked vote tokens back to the user's VTA. This is a **permissionless** operation - anyone can reveal any user's shares after the winner is selected and staking has ended.

## Encrypted Circuit: `reveal_shares`

Decrypts the share purchase data, reveals the amount and option as plaintext, and adds the staked amount back to the user's encrypted VTA balance.

## Events

Emits `SharesRevealedEvent`:
- `buyer`: Owner's public key
- `shares_amount`: Revealed share amount
- `selected_option`: Revealed option index
