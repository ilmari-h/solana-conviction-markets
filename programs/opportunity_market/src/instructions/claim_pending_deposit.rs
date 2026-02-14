use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use crate::instructions::init_encrypted_token_account::ENCRYPTED_TOKEN_ACCOUNT_SEED;
use crate::state::EncryptedTokenAccount;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct ClaimPendingDeposit<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = encrypted_token_account.owner == signer.key() @ ErrorCode::Unauthorized,
        constraint = encrypted_token_account.token_mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub encrypted_token_account: Account<'info, EncryptedTokenAccount>,

    /// ATA owned by ETA PDA (source of pending tokens)
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = encrypted_token_account,
        associated_token::token_program = token_program,
    )]
    pub encrypted_token_ata: InterfaceAccount<'info, TokenAccount>,

    /// Signer's token account (destination for claimed tokens)
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub signer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_pending_deposit(ctx: Context<ClaimPendingDeposit>) -> Result<()> {
    let eta = &mut ctx.accounts.encrypted_token_account;

    // If no pending deposit, return success (no-op)
    if eta.pending_deposit == 0 {
        return Ok(());
    }

    // Transfer pending tokens from ETA ATA back to signer
    let mint_key = eta.token_mint;
    let owner_key = eta.owner;
    let index_bytes = eta.index.to_le_bytes();
    let bump = eta.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        ENCRYPTED_TOKEN_ACCOUNT_SEED,
        mint_key.as_ref(),
        owner_key.as_ref(),
        &index_bytes,
        &[bump],
    ]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.encrypted_token_ata.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.signer_token_account.to_account_info(),
                authority: eta.to_account_info(),
            },
            signer_seeds,
        ),
        eta.pending_deposit,
        ctx.accounts.token_mint.decimals,
    )?;

    // Clear pending deposit
    eta.pending_deposit = 0;
    eta.locked = false;

    Ok(())
}
