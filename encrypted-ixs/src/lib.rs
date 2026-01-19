use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;


    // Vote token state - tracks encrypted token amount for a user
    pub struct UserVoteTokenBalance {
        pub amount: u64,
    }

    // User's share position in a conviction market
    pub struct UserMarketSharePosition {
        pub share_amount: u64,
        pub selected_option: u16,
    }

    // User input for buying market shares (encrypted)
    pub struct BuySharesInput {
        pub amount: u64,
        pub selected_option: u16,
    }

    // Initialize empty vote token balance for user
    #[instruction]
    pub fn init_vote_token_account(
        mxe: Mxe
    ) -> Enc<Mxe, UserVoteTokenBalance> {
        let state = UserVoteTokenBalance { amount: 0 };
        mxe.from_arcis(state)
    }

    // Calculate vote token balance for buy/sell operations
    // Returns (error, new_balance) where error=true means insufficient balance for sell
    #[instruction]
    pub fn calculate_vote_token_balance(
        balance_ctx: Enc<Mxe, UserVoteTokenBalance>,
        amount: u64,
        sell: bool
    ) -> (bool, u64, Enc<Mxe, UserVoteTokenBalance>) {
        let mut balance = balance_ctx.to_arcis();
        let sold: u64 = if sell { amount } else {0};

        // Check for insufficient balance when selling
        let insufficient_balance = sell && (amount > balance.amount);

        // Calculate new balance based on operation type and validity
        let new_amount = if sell {
            if insufficient_balance {
                balance.amount  // Keep unchanged on error
            } else {
                balance.amount - amount
            }
        } else {
            balance.amount + amount
        };

        balance.amount = new_amount;

        // Return error flag (true = error) and updated balance
        (insufficient_balance.reveal(), sold, balance_ctx.owner.from_arcis(balance))
    }

    // Simplified: just check if user has enough balance
    // Returns true if error (insufficient balance), false if OK
    #[instruction]
    pub fn buy_conviction_market_shares(
        input_ctx: Enc<Shared, BuySharesInput>,
        user_vta_ctx: Enc<Mxe, UserVoteTokenBalance>,
    ) -> bool {
        let input = input_ctx.to_arcis();
        let user_balance = user_vta_ctx.to_arcis();

        let amount = input.amount;

        // Check if user has sufficient balance
        let insufficient_balance = amount > user_balance.amount;

        insufficient_balance.reveal()
    }
}
