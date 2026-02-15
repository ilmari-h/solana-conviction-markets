use anchor_lang::prelude::*;

use crate::state::TokenVault;

pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";

#[derive(Accounts)]
pub struct InitTokenVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + TokenVault::INIT_SPACE,
        seeds = [TOKEN_VAULT_SEED],
        bump,
    )]
    pub token_vault: Box<Account<'info, TokenVault>>,

    pub system_program: Program<'info, System>,
}

pub fn init_token_vault(
    ctx: Context<InitTokenVault>,
    fund_manager: Pubkey,
) -> Result<()> {
    let vault = &mut ctx.accounts.token_vault;
    vault.bump = ctx.bumps.token_vault;
    vault.fund_manager = fund_manager;

    Ok(())
}
