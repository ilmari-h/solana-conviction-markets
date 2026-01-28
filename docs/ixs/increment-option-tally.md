# increment_option_tally

Adds a revealed share position to the option's total tally.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `signer` | Signer, Mutable | Anyone can call this (permissionless) |
| `owner` | Unchecked | The owner of the share account |
| `market` | Account | The ConvictionMarket |
| `share_account` | Mutable | The ShareAccount (must be revealed) |
| `option` | Mutable | The ConvictionMarketOption being tallied |
| `system_program` | Program | Solana System Program |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `option_index` | `u16` | Index of the option to increment |

## Description

After shares are revealed, this instruction adds them to the option's running tally. Calculates a conviction score that weights shares by time held: `user_score = revealed_amount * time_in_market`. Users who stake earlier get higher scores. Must be called during the reveal window. This is a **permissionless** operation.
