# mint_vote_tokens

Purchases vote tokens by depositing SOL.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | The user buying vote tokens |
| `vote_token_account` | Mutable | The user's VoteTokenAccount |
| `sign_pda_account` | PDA | Arcium signer account |
| `mxe_account` | Account | Arcium MXE account |
| `mempool_account` | Mutable | Arcium mempool |
| `executing_pool` | Mutable | Arcium execution pool |
| `computation_account` | Mutable | Arcium computation tracking account |
| `comp_def_account` | Account | Computation definition for `buy_vote_tokens` circuit |
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
| `amount` | `u64` | Number of vote tokens to purchase |

## Description

Allows users to purchase vote tokens by depositing SOL. The exchange rate is fixed at **0.001 SOL per vote token**. SOL transfers from the user to the VTA PDA, and the MPC circuit adds the tokens to the user's encrypted balance.

## Encrypted Circuit: `buy_vote_tokens`

Decrypts the current balance, adds the purchased amount, and re-encrypts the updated balance.
