use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::instructions::buy_market_shares::SHARE_ACCOUNT_SEED;
use crate::state::{ConvictionMarket, ShareAccount};

#[derive(Accounts)]
pub struct CloseShareAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub market: Account<'info, ConvictionMarket>,

    #[account(
        mut,
        seeds = [SHARE_ACCOUNT_SEED, owner.key().as_ref(), market.key().as_ref()],
        bump = share_account.bump,
        close = owner,
    )]
    pub share_account: Account<'info, ShareAccount>,

    pub system_program: Program<'info, System>,
}

pub fn close_share_account(ctx: Context<CloseShareAccount>) -> Result<()> {
    let share_account = &ctx.accounts.share_account;
    let market = &ctx.accounts.market;

    // Check that shares have been revealed
    if share_account.revealed_amount.is_none() || share_account.revealed_option.is_none() {
        return Err(ErrorCode::NotRevealed.into());
    }

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

    // Check if
    // 1. this share was bought for the winning option
    // 2. user revealed their option in time and incremented the total tally
    // => allow claiming yield
    if let (Some(revealed_option), Some(selected_option) ) =
        (share_account.revealed_option, market.selected_option) {
        if revealed_option == selected_option && share_account.total_incremented  {


        }
    }

    // Account will be closed automatically via the close constraint
    Ok(())
}
