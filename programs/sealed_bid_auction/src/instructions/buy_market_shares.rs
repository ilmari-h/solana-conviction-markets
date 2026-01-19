use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

use crate::error::ErrorCode;
use crate::instructions::mint_vote_tokens::VOTE_TOKEN_ACCOUNT_SEED;
use crate::state::{ConvictionMarket, ConvictionMarketShare, VoteToken};
use crate::COMP_DEF_OFFSET_BUY_CONVICTION_MARKET_SHARES;
use crate::{ID, ID_CONST, SignerAccount};

pub const CONVICTION_MARKET_SHARE_SEED: &[u8] = b"conviction_market_share";

#[queue_computation_accounts("buy_conviction_market_shares", signer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct BuyMarketShares<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        constraint = market.open_timestamp.is_some() @ ErrorCode::MarketNotOpen,
    )]
    pub market: Account<'info, ConvictionMarket>,

    #[account(
        mut,
        seeds = [VOTE_TOKEN_ACCOUNT_SEED, signer.key().as_ref()],
        bump = user_vote_token_account.bump,
    )]
    pub user_vote_token_account: Account<'info, VoteToken>,

    // Arcium accounts
    #[account(
        init_if_needed,
        space = 9,
        payer = signer,
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_BUY_CONVICTION_MARKET_SHARES))]
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

pub fn buy_market_shares(
    ctx: Context<BuyMarketShares>,
    computation_offset: u64,
    amount_ciphertext: [u8; 32],
    selected_option_ciphertext: [u8; 32],
    user_pubkey: [u8; 32],
    input_nonce: u128,
) -> Result<()> {
    let user_vta_key = ctx.accounts.user_vote_token_account.key();
    let user_vta_nonce = ctx.accounts.user_vote_token_account.state_nonce;

    // Build args for encrypted computation
    // Circuit signature: buy_conviction_market_shares(input_ctx, user_vta_ctx) -> bool
    let args = ArgBuilder::new()
        .x25519_pubkey(user_pubkey)
        .plaintext_u128(input_nonce)
        .encrypted_u64(amount_ciphertext)
        .encrypted_u16(selected_option_ciphertext)

        .plaintext_u128(user_vta_nonce)
        .account(user_vta_key, 8, 32 * 1)
        .build();

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    // Queue computation with callback
    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        None,
        vec![BuyConvictionMarketSharesCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
                  &[                                                                                                                
                      CallbackAccount {                                                                                             
                          pubkey: user_vta_key,                                                                                     
                          is_writable: true,                                                                                        
                      },                                                                                                            
                  ],  
        )?],
        1,
        0,
    )?;

    Ok(())
}

#[callback_accounts("buy_conviction_market_shares")]
#[derive(Accounts)]
pub struct BuyConvictionMarketSharesCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_BUY_CONVICTION_MARKET_SHARES))]
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
    pub user_vote_token_account: Account<'info, VoteToken>,
}

pub fn buy_conviction_market_shares_callback(
    ctx: Context<BuyConvictionMarketSharesCallback>,
    output: SignedComputationOutputs<BuyConvictionMarketSharesOutput>,
) -> Result<()> {
    // Output is just bool (true = error/insufficient balance)
    let has_error: bool = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(BuyConvictionMarketSharesOutput { field_0 }) => field_0,
        Err(_) => return Err(ErrorCode::AbortedComputation.into()),
    };

    if has_error {
        return Err(ErrorCode::SharePurchaseFailed.into());
    }
    ctx.accounts.user_vote_token_account.state_nonce = 0;

    Ok(())
}
