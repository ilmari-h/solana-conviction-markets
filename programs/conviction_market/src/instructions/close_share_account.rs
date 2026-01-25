use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::instructions::buy_market_shares::SHARE_ACCOUNT_SEED;
use crate::state::{ConvictionMarket, ConvictionMarketOption, ShareAccount};

#[derive(Accounts)]
#[instruction(option_index: u16)]
pub struct CloseShareAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, ConvictionMarket>,

    #[account(
        mut,
        seeds = [SHARE_ACCOUNT_SEED, owner.key().as_ref(), market.key().as_ref()],
        bump = share_account.bump,
        close = owner,
    )]
    pub share_account: Account<'info, ShareAccount>,

    #[account(
        seeds = [b"option", market.key().as_ref(), &option_index.to_le_bytes()],
        bump = option.bump,
    )]
    pub option: Account<'info, ConvictionMarketOption>,

    pub system_program: Program<'info, System>,
}

pub fn close_share_account(ctx: Context<CloseShareAccount>, option_index: u16) -> Result<()> {
    let share_account = &ctx.accounts.share_account;
    let market = &ctx.accounts.market;
    let option = &ctx.accounts.option;

    // Check that shares have been revealed
    let revealed_option = share_account.revealed_option.ok_or(ErrorCode::NotRevealed)?;
    if share_account.revealed_amount.is_none() {
        return Err(ErrorCode::NotRevealed.into());
    }

    // Check that the option_index matches the user's revealed option
    require!(
        revealed_option == option_index,
        ErrorCode::InvalidOptionIndex
    );

    // Check that reveal period is over
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;

    if let Some(open_timestamp) = market.open_timestamp {
        let reveal_end = open_timestamp
            .checked_add(market.time_to_stake)
            .and_then(|t| t.checked_add(market.time_to_reveal))
            .ok_or(ErrorCode::Overflow)?;

        if current_time < reveal_end {
            return Err(ErrorCode::MarketNotResolved.into());
        }
    } else {
        // Market hasn't been opened yet
        return Err(ErrorCode::MarketNotOpen.into());
    }

    // Check if this share was bought for the winning option and user incremented the tally
    // If so, transfer proportional yield from market to user
    if let Some(selected_option) = market.selected_option {
        if revealed_option == selected_option && share_account.total_incremented {
            // User is eligible for yield
            let user_score = share_account.revealed_score.ok_or(ErrorCode::NotRevealed)?;
            let total_score = option.total_score.ok_or(ErrorCode::NotRevealed)?;

            // Calculate proportional reward: (user_score / total_score) * reward_lamports
            // Use u128 to prevent overflow during multiplication
            let reward_lamports = market.reward_lamports as u128;
            let user_reward = (user_score as u128)
                .checked_mul(reward_lamports)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(total_score as u128)
                .ok_or(ErrorCode::Overflow)? as u64; // Round down

            // Transfer lamports from market to owner
            if user_reward > 0 {
                **market.to_account_info().try_borrow_mut_lamports()? = market
                    .to_account_info()
                    .lamports()
                    .checked_sub(user_reward)
                    .ok_or(ErrorCode::InsufficientRewardFunding)?;

                **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? = ctx
                    .accounts
                    .owner
                    .to_account_info()
                    .lamports()
                    .checked_add(user_reward)
                    .ok_or(ErrorCode::Overflow)?;
            }
        }
    }

    // Account will be closed automatically via the close constraint
    Ok(())
}
