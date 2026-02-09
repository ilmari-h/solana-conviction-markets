use anchor_lang::prelude::*;

use crate::state::CentralState;

#[derive(Accounts)]
pub struct InitCentralState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + CentralState::INIT_SPACE,
        seeds = [b"central_state"],
        bump,
    )]
    pub central_state: Account<'info, CentralState>,

    pub system_program: Program<'info, System>,
}

pub fn init_central_state(
    ctx: Context<InitCentralState>,
    earliness_saturation: u64,
    time_in_market_saturation: u64,
) -> Result<()> {
    let central_state = &mut ctx.accounts.central_state;
    central_state.bump = ctx.bumps.central_state;
    central_state.authority = ctx.accounts.payer.key();
    central_state.earliness_saturation = earliness_saturation;
    central_state.time_in_market_saturation = time_in_market_saturation;

    Ok(())
}
