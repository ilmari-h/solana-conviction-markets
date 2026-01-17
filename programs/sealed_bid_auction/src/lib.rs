#![allow(ambiguous_glob_reexports)]

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use error::ErrorCode;
pub use instructions::*;
pub use state::*;

pub const COMP_DEF_OFFSET_INIT_MARKET_STATE: u32 = comp_def_offset("init_market_state");
pub const COMP_DEF_OFFSET_INIT_VOTE_TOKEN: u32 = comp_def_offset("init_vote_token");

declare_id!("D1Zf4HpT6LpLZhGbUD4QXqAHjseNq2Ni8C4aVE2urtuw");

#[arcium_program]
pub mod sealed_bid_auction {
    use super::*;

    pub fn init_market_state_comp_def(ctx: Context<InitMarketStateCompDef>) -> Result<()> {
        instructions::init_market_state_comp_def(ctx)
    }

    pub fn init_vote_token_comp_def(ctx: Context<InitVoteTokenCompDef>) -> Result<()> {
        instructions::init_vote_token_comp_def(ctx)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_index: u64,
        reward_token_amount: u64,
    ) -> Result<()> {
        instructions::create_market(ctx, market_index, reward_token_amount)
    }

    pub fn purchase_vote_token(
        ctx: Context<PurchaseVoteToken>,
        computation_offset: u64,
        lamports_to_spend: u64,
        encrypted_amount: [u8; 32],
        buyer_pubkey: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        instructions::purchase_vote_token(
            ctx,
            computation_offset,
            lamports_to_spend,
            encrypted_amount,
            buyer_pubkey,
            nonce,
        )
    }

    #[arcium_callback(encrypted_ix = "init_vote_token")]
    pub fn init_vote_token_callback(
        ctx: Context<InitVoteTokenCallback>,
        output: SignedComputationOutputs<InitVoteTokenOutput>,
    ) -> Result<()> {
        instructions::init_vote_token_callback(ctx, output)
    }
}
