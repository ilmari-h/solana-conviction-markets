# claim_vote_tokens

Sells vote tokens back for SOL.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | The user selling vote tokens |
| `vote_token_account` | Mutable | The user's VoteTokenAccount |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE account |
| `mempool_account` | Mutable | Arcium mempool |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `claim_vote_tokens` circuit |
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
| `amount` | `u64` | Number of vote tokens to sell |

## Description

Allows users to sell vote tokens back for SOL at **0.001 SOL per token**. The MPC circuit verifies sufficient balance and deducts from the encrypted balance. The callback transfers SOL from the VTA PDA to the user.

## Encrypted Circuit: `claim_vote_tokens`

Validates the user has sufficient balance, deducts the amount, and returns an error flag plus the amount sold (revealed) along with the updated encrypted balance.
