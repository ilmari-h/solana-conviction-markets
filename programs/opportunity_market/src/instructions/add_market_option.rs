use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

use crate::error::ErrorCode;
use crate::state::{CentralState, OpportunityMarket, OpportunityMarketOption, VoteTokenAccount};
use crate::instructions::init_vote_token_account::VOTE_TOKEN_ACCOUNT_SEED;
use crate::COMP_DEF_OFFSET_LOCK_OPTION_DEPOSIT;
use crate::{ID, ID_CONST, ArciumSignerAccount};

#[queue_computation_accounts("lock_option_deposit", creator)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, option_index: u16)]
pub struct AddMarketOption<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = market.selected_option.is_none() @ ErrorCode::WinnerAlreadySelected,
    )]
    pub market: Box<Account<'info, OpportunityMarket>>,

    #[account(
        seeds = [b"central_state"],
        bump = central_state.bump,
    )]
    pub central_state: Box<Account<'info, CentralState>>,

    #[account(
        init,
        payer = creator,
        space = 8 + OpportunityMarketOption::INIT_SPACE,
        seeds = [b"option", market.key().as_ref(), &option_index.to_le_bytes()],
        bump,
    )]
    pub option: Box<Account<'info, OpportunityMarketOption>>,

    #[account(
        constraint = source_vta.owner == creator.key() @ ErrorCode::Unauthorized,
        constraint = source_vta.token_mint == market.mint @ ErrorCode::InvalidMint,
        constraint = source_vta.locked_market.is_none() @ ErrorCode::LockedVtaMarketMismatch,
    )]
    pub source_vta: Box<Account<'info, VoteTokenAccount>>,

    #[account(
        init,
        payer = creator,
        space = 8 + VoteTokenAccount::INIT_SPACE,
        seeds = [VOTE_TOKEN_ACCOUNT_SEED, market.mint.as_ref(), creator.key().as_ref(), market.key().as_ref(), &option_index.to_le_bytes()],
        bump,
    )]
    pub locked_vta: Box<Account<'info, VoteTokenAccount>>,

    // Arcium accounts
    #[account(
        init_if_needed,
        space = 9,
        payer = creator,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_LOCK_OPTION_DEPOSIT))]
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Box<Account<'info, Cluster>>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

pub fn add_market_option(
    ctx: Context<AddMarketOption>,
    computation_offset: u64,
    option_index: u16,
    name: String,
    amount: u64,
    user_pubkey: [u8; 32],
    locked_vta_nonce: u128,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // Option index must match total_options + 1
    require!(
        option_index == market.total_options + 1,
        ErrorCode::InvalidOptionIndex
    );

    // Validate deposit amount meets minimum
    require!(
        amount >= ctx.accounts.central_state.min_option_deposit,
        ErrorCode::DepositBelowMinimum
    );

    // Increment total options
    market.total_options = option_index;

    // Initialize the option account
    let option = &mut ctx.accounts.option;
    option.bump = ctx.bumps.option;
    option.name = name;
    option.total_shares = None;
    option.total_score = None;
    option.creator = ctx.accounts.creator.key();

    // Initialize the locked VTA
    let locked_vta = &mut ctx.accounts.locked_vta;
    locked_vta.bump = ctx.bumps.locked_vta;
    locked_vta.owner = ctx.accounts.creator.key();
    locked_vta.token_mint = market.mint;
    locked_vta.state_nonce = 0;
    locked_vta.pending_deposit = 0;
    locked_vta.encrypted_state = [[0; 32]; 1];
    locked_vta.locked_option = Some(option_index);
    locked_vta.locked_market = Some(market.key());

    let source_vta_key = ctx.accounts.source_vta.key();
    let source_vta_nonce = ctx.accounts.source_vta.state_nonce;
    let locked_vta_key = ctx.accounts.locked_vta.key();

    // Build args for encrypted computation
    let args = ArgBuilder::new()
        // Source VTA (Enc<Shared, VoteTokenBalance>)
        .x25519_pubkey(user_pubkey)
        .plaintext_u128(source_vta_nonce)
        .account(source_vta_key, 8, 32 * 1)
        // Plaintext amount
        .plaintext_u64(amount)
        // Dest context (Shared)
        .x25519_pubkey(user_pubkey)
        .plaintext_u128(locked_vta_nonce)
        .build();

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    // Queue computation with callback
    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![LockOptionDepositCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: source_vta_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: locked_vta_key,
                    is_writable: true,
                },
            ],
        )?],
        1,
        0,
    )?;

    Ok(())
}

#[callback_accounts("lock_option_deposit")]
#[derive(Accounts)]
pub struct LockOptionDepositCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_LOCK_OPTION_DEPOSIT))]
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

    // Callback accounts
    #[account(mut)]
    pub source_vta: Account<'info, VoteTokenAccount>,

    #[account(mut)]
    pub locked_vta: Account<'info, VoteTokenAccount>,
}

pub fn add_market_option_callback(
    ctx: Context<LockOptionDepositCallback>,
    output: SignedComputationOutputs<LockOptionDepositOutput>,
) -> Result<()> {
    let res = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(LockOptionDepositOutput { field_0 }) => field_0,
        Err(_) => return Err(ErrorCode::AbortedComputation.into()),
    };

    let has_error = res.field_0;
    let new_source_balance = res.field_1;
    let new_dest_balance = res.field_2;

    if has_error {
        return Err(ErrorCode::LockDepositFailed.into());
    }

    // Update source VTA
    ctx.accounts.source_vta.state_nonce = new_source_balance.nonce;
    ctx.accounts.source_vta.encrypted_state = new_source_balance.ciphertexts;

    // Update locked VTA
    ctx.accounts.locked_vta.state_nonce = new_dest_balance.nonce;
    ctx.accounts.locked_vta.encrypted_state = new_dest_balance.ciphertexts;

    Ok(())
}
