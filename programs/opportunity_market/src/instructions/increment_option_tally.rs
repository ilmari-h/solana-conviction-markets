use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::instructions::buy_market_shares::SHARE_ACCOUNT_SEED;
use crate::state::{OpportunityMarket, OpportunityMarketOption, ShareAccount};

#[derive(Accounts)]
#[instruction(option_index: u16)]
pub struct IncrementOptionTally<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: this is a permissionless operation
    pub owner: UncheckedAccount<'info>,

    pub market: Account<'info, OpportunityMarket>,

    #[account(
        mut,
        seeds = [SHARE_ACCOUNT_SEED, owner.key().as_ref(), market.key().as_ref()],
        bump = share_account.bump,

        constraint = !share_account.total_incremented @ ErrorCode::TallyAlreadyIncremented,
    )]
    pub share_account: Account<'info, ShareAccount>,

    #[account(
        mut,
        seeds = [b"option", market.key().as_ref(), &option_index.to_le_bytes()],
        bump = option.bump,
    )]
    pub option: Account<'info, OpportunityMarketOption>,

    pub system_program: Program<'info, System>,
}

pub fn increment_option_tally(ctx: Context<IncrementOptionTally>, _option_index: u16) -> Result<()> {
    // Check that we are within the reveal window
    let market = &ctx.accounts.market;
    let open_timestamp = market.open_timestamp.ok_or(ErrorCode::MarketNotOpen)?;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;

    let reveal_start = open_timestamp
        .checked_add(market.time_to_stake)
        .ok_or(ErrorCode::Overflow)?;
    let reveal_end = reveal_start
        .checked_add(market.time_to_reveal)
        .ok_or(ErrorCode::Overflow)?;

    require!(
        current_time >= reveal_start && current_time <= reveal_end,
        ErrorCode::MarketNotResolved
    );

    let revealed_amount = ctx.accounts.share_account.revealed_amount.ok_or(ErrorCode::NotRevealed)?;

    // Initialize total_shares to 0 if None, then add revealed_amount
    let current_total = ctx.accounts.option.total_shares.unwrap_or(0);
    ctx.accounts.option.total_shares = Some(
        current_total
            .checked_add(revealed_amount)
            .ok_or(ErrorCode::Overflow)?
    );

    // Initialize total_score to 0 if None, then add user's amount
    let bought_at_timestamp = ctx.accounts.share_account.bought_at_timestamp;
    let user_time_in_market = reveal_start
        .checked_sub(bought_at_timestamp)
        .ok_or(ErrorCode::Overflow)?
        .max(1); // Ensure minimum of 1 to avoid zero scores

    // TODO: we can adjust this formula, now weight of time in market is same as stake amount
    let user_score = revealed_amount
        .checked_mul(user_time_in_market)
        .ok_or(ErrorCode::Overflow)?;

    let current_total_score = ctx.accounts.option.total_score.unwrap_or(0);

    ctx.accounts.option.total_score = Some(
        current_total_score.checked_add(user_score).ok_or(ErrorCode::Overflow)?
    );

    // Store the user's score on their share account for yield calculation
    ctx.accounts.share_account.revealed_score = Some(user_score);
    ctx.accounts.share_account.total_incremented = true;
    Ok(())
}
