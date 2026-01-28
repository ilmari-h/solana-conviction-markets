# init_share_account

Initializes a share account for a user in a specific market.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | The user creating their share account |
| `market` | Account | The ConvictionMarket to participate in |
| `share_account` | PDA, Init | The ShareAccount to be created |
| `system_program` | Program | Solana System Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `state_nonce` | `u128` | Random nonce for encryption |

## Description

Creates a share account that stores the user's position (shares purchased and selected option) in a specific market. Each user needs one share account per market. The account is initialized empty and populated when the user calls `buy_market_shares`.
