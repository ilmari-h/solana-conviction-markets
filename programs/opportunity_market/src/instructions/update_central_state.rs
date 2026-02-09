use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::CentralState;

#[derive(Accounts)]
pub struct UpdateCentralState<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"central_state"],
        bump = central_state.bump,
        constraint = central_state.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub central_state: Account<'info, CentralState>,
}

pub fn update_central_state(
    ctx: Context<UpdateCentralState>,
    earliness_saturation: u64,
    time_in_market_saturation: u64,
) -> Result<()> {
    let central_state = &mut ctx.accounts.central_state;
    central_state.earliness_saturation = earliness_saturation;
    central_state.time_in_market_saturation = time_in_market_saturation;
    Ok(())
}
