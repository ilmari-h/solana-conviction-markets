use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::events::MarketCreatedEvent;
use crate::ConvictionMarket;

#[derive(Accounts)]
#[instruction(market_index: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + ConvictionMarket::INIT_SPACE,
        seeds = [b"conviction_market", creator.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, ConvictionMarket>,

    pub system_program: Program<'info, System>,

    pub reward_token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}
pub fn create_market(ctx: Context<CreateMarket>, market_index: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.bump = ctx.bumps.market;
    market.creator = ctx.accounts.creator.key();
    market.index = market_index;
    market.current_options = 0;
    market.reward_token_mint = ctx.accounts.reward_token_mint.key();

    emit!(MarketCreatedEvent {
        market: market.key(),
        creator: market.creator,
        index: market_index,
    });

    Ok(())
}