# close_share_account

Closes a share account and claims proportional rewards if eligible.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `owner` | Signer, Mutable | The owner of the share account (receives rent + rewards) |
| `market` | Mutable | The ConvictionMarket |
| `share_account` | Mutable, Close | The ShareAccount to close (rent returned to owner) |
| `option` | Account | The ConvictionMarketOption for the user's revealed option |
| `system_program` | Program | Solana System Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `option_index` | `u16` | Index of the option (must match user's revealed option) |

## Description

Closes a user's share account after the reveal period ends. If the user voted for the winning option and incremented the tally, they receive their proportional share of the reward pool: `user_reward = (user_score / total_score) * reward_lamports`. The share account rent is also returned to the owner.
