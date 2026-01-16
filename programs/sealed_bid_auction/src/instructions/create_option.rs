use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

use crate::error::ErrorCode;
use crate::state::{ConvictionMarket, ConvictionOption};
use crate::COMP_DEF_OFFSET_INIT_OPTION_STATE;
use crate::{ID, ID_CONST, SignerAccount};

#[queue_computation_accounts("init_option_state", creator)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, option_index: u16)]
pub struct CreateOption<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        constraint = market.current_options < market.max_options @ ErrorCode::MaxOptionsReached,
        constraint = option_index == market.current_options.checked_add(1).unwrap() @ ErrorCode::InvalidOptionIndex,
    )]
    pub market: Account<'info, ConvictionMarket>,
    #[account(
        init,
        payer = creator,
        space = 8 + ConvictionOption::INIT_SPACE,
        seeds = [
            b"conviction_option",
            market.key().as_ref(),
            &option_index.to_le_bytes()
        ],
        bump,
    )]
    pub option: Account<'info, ConvictionOption>,
    #[account(
        init_if_needed,
        space = 9,
        payer = creator,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_OPTION_STATE))]
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

pub fn create_option(
    ctx: Context<CreateOption>,
    computation_offset: u64,
    option_index: u16,
    nonce: u128,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.current_options = option_index;

    let option = &mut ctx.accounts.option;
    option.bump = ctx.bumps.option;
    option.option_index = option_index;
    option.market = market.key();
    option.state_nonce = nonce;
    option.encrypted_state = [[0u8; 32]; 1];

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = ArgBuilder::new().plaintext_u128(nonce).build();

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        None,
        vec![InitOptionStateCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[CallbackAccount {
                pubkey: ctx.accounts.option.key(),
                is_writable: true,
            }],
        )?],
        1,
        0,
    )?;

    Ok(())
}

#[callback_accounts("init_option_state")]
#[derive(Accounts)]
pub struct InitOptionStateCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_OPTION_STATE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: computation_account, checked by arcium program via constraints in the callback context.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub option: Account<'info, ConvictionOption>,
}

pub fn init_option_state_callback(
    ctx: Context<InitOptionStateCallback>,
    output: SignedComputationOutputs<InitOptionStateOutput>,
) -> Result<()> {
    let o = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(InitOptionStateOutput { field_0 }) => field_0,
        Err(_) => return Err(ErrorCode::AbortedComputation.into()),
    };

    let option = &mut ctx.accounts.option;
    option.encrypted_state = o.ciphertexts;
    option.state_nonce = o.nonce;

    Ok(())
}
