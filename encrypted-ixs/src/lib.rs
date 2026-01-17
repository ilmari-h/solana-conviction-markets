use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // Conviction market state - tracks vote counts for all options
    pub struct MarketState {
        pub votes: [u64; 7],
    }

    #[instruction]
    pub fn init_market_state(mxe: Mxe) -> Enc<Mxe, MarketState> {
        let initial_state = MarketState {
            votes: [0, 0, 0, 0, 0, 0, 0],
        };
        mxe.from_arcis(initial_state)
    }

    // Vote token state - tracks encrypted token amount for a user
    pub struct VoteTokenState {
        pub amount: u64,
    }

    #[instruction]
    pub fn init_vote_token(
        amount_ctxt: Enc<Shared, u64>,
        mxe: Mxe,
    ) -> Enc<Mxe, VoteTokenState> {
        let amount = amount_ctxt.to_arcis();
        let state = VoteTokenState { amount };
        mxe.from_arcis(state)
    }
}
