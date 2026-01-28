# add_market_option

Adds a named voting option to a market.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `creator` | Signer, Mutable | The market creator (must match market's creator) |
| `market` | Mutable | The ConvictionMarket account |
| `option` | PDA, Init | The ConvictionMarketOption account to be created |
| `system_program` | Program | Solana System Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `option_index` | `u16` | Sequential index for this option (must equal `total_options + 1`) |
| `name` | `String` | Human-readable name for the option (max 50 characters) |

## Description

Adds a new voting option to a market. Options must be added sequentially (1, 2, 3, etc.) before the market is opened. Only the market creator can add options, and the total cannot exceed `max_options`.
