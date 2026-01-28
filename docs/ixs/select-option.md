# select_option

Selects the winning option and ends the staking period.

## Accounts

| Account | Type | Description |
|---------|------|-------------|
| `authority` | Signer | The market creator or designated `select_authority` |
| `market` | Mutable | The ConvictionMarket account |

## Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `option_index` | `u16` | Index of the winning option (0-indexed, must be < `total_options`) |

## Description

Allows the decision maker to select the winning option. Sets `selected_option` on the market and enables the reveal phase. If called before the staking period ends, staking closes immediately.

Either the market `creator` or the `select_authority` (if specified at creation) can call this instruction.
