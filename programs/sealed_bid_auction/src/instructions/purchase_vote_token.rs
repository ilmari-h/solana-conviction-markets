use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

use crate::error::ErrorCode;
use crate::state::{VoteToken, VoteTokenVault};
use crate::COMP_DEF_OFFSET_INIT_VOTE_TOKEN;
use crate::{ID, ID_CONST, SignerAccount};

pub const VOTE_TOKEN_VAULT_SEED: &[u8] = b"vote_token_vault";

#[queue_computation_accounts("init_vote_token", buyer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct PurchaseVoteToken<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        init,
        payer = buyer,
        space = 8 + VoteToken::INIT_SPACE,
        seeds = [b"vote_token", buyer.key().as_ref()],
        bump,
    )]
    pub vote_token: Account<'info, VoteToken>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + VoteTokenVault::INIT_SPACE,
        seeds = [VOTE_TOKEN_VAULT_SEED],
        bump,
    )]
    pub vote_token_vault: Account<'info, VoteTokenVault>,

    // Arcium accounts
    #[account(
        init_if_needed,
        space = 9,
        payer = buyer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_VOTE_TOKEN))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

pub fn purchase_vote_token(
    ctx: Context<PurchaseVoteToken>,
    computation_offset: u64,
    lamports_to_spend: u64,
    encrypted_amount: [u8; 32],
    buyer_pubkey: [u8; 32],
    nonce: u128,
) -> Result<()> {
    // Transfer SOL to vault
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.vote_token_vault.to_account_info(),
            },
        ),
        lamports_to_spend,
    )?;

    // Update vault tracking
    let vault = &mut ctx.accounts.vote_token_vault;
    if vault.bump == 0 {
        vault.bump = ctx.bumps.vote_token_vault;
    }
    vault.bought_lamports = vault.bought_lamports.checked_add(lamports_to_spend)
        .ok_or(ErrorCode::Overflow)?;

    // Initialize vote token fields
    let vote_token = &mut ctx.accounts.vote_token;
    vote_token.bump = ctx.bumps.vote_token;
    vote_token.owner = ctx.accounts.buyer.key();
    vote_token.state_nonce = nonce;

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    // Build args for encrypted computation
    let args = ArgBuilder::new()
        .x25519_pubkey(buyer_pubkey)
        .encrypted_u64(encrypted_amount)
        .plaintext_u128(nonce)
        .build();

    // Queue computation with callback
    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        None,
        vec![InitVoteTokenCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[CallbackAccount {
                pubkey: ctx.accounts.vote_token.key(),
                is_writable: true,
            }],
        )?],
        1,
        0,
    )?;

    Ok(())
}

#[callback_accounts("init_vote_token")]
#[derive(Accounts)]
pub struct InitVoteTokenCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_VOTE_TOKEN))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub vote_token: Account<'info, VoteToken>,
}

pub fn init_vote_token_callback(
    ctx: Context<InitVoteTokenCallback>,
    output: SignedComputationOutputs<InitVoteTokenOutput>,
) -> Result<()> {
    let o = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(InitVoteTokenOutput { field_0 }) => field_0,
        Err(_) => return Err(ErrorCode::AbortedComputation.into()),
    };

    let vote_token = &mut ctx.accounts.vote_token;
    vote_token.state_nonce = o.nonce;
    vote_token.encrypted_state = o.ciphertexts;

    Ok(())
}
