use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::ConvictionMarket;
use crate::events::MarketCreatedEvent;

#[derive(Accounts)]
#[instruction(market_index: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + ConvictionMarket::INIT_SPACE,
        seeds = [b"conviction_market", creator.key().as_ref(), &market_index.to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, ConvictionMarket>,
    pub reward_token_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn create_market(
    ctx: Context<CreateMarket>,
    market_index: u64,
    reward_token_amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.bump = ctx.bumps.market;
    market.creator = ctx.accounts.creator.key();
    market.index = market_index;
    market.reward_token_mint = ctx.accounts.reward_token_mint.key();
    market.reward_token_amount = reward_token_amount;

    emit!(MarketCreatedEvent {
        market: ctx.accounts.market.key(),
        creator: ctx.accounts.creator.key(),
        index: market_index,
    });

    Ok(())
}
