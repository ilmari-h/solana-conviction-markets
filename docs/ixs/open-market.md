# open_market

Opens a market for staking after it has been funded.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `creator` | Signer | The market creator (must match market's creator) |
| `market` | Mutable | The ConvictionMarket account |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `open_timestamp` | `u64` | Unix timestamp when staking should begin (must be in the future) |

## Description

Transitions a market from draft to active state. Before calling, the creator must transfer `reward_lamports` to the market PDA. The `open_timestamp` defines when staking begins; the staking period runs until `open_timestamp + time_to_stake`.
