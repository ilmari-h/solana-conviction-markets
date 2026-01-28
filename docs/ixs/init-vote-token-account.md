# init_vote_token_account

Initializes an encrypted vote token account for a user.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | The user creating their vote token account |
| `vote_token_account` | PDA, Init | The VoteTokenAccount to be created |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE account |
| `mempool_account` | Mutable | Arcium mempool |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `init_vote_token_account` circuit |
| `cluster_account` | Mutable | Arcium cluster account |
| `pool_account` | Mutable | Arcium fee pool |
| `clock_account` | Mutable | Arcium clock |
| `system_program` | Program | Solana System Program |
| `arcium_program` | Program | Arcium Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `computation_offset` | `u64` | Unique offset for the MPC computation |
| `user_pubkey` | `[u8; 32]` | User's x25519 public key for encryption |
| `nonce` | `u128` | Random nonce for encryption |

## Description

Creates a user's vote token account, which holds their encrypted vote token balance. Users must initialize this account before buying or selling vote tokens.

## Encrypted Circuit: `init_vote_token_account`

Initializes the encrypted balance to zero using the user's x25519 public key.
