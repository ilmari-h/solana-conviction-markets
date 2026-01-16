use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Auction is not open for bidding")]
    AuctionNotOpen,
    #[msg("Auction is not closed yet")]
    AuctionNotClosed,
    #[msg("Wrong auction type for this operation")]
    WrongAuctionType,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Maximum number of options reached for this market")]
    MaxOptionsReached,
    #[msg("Invalid option index - must be current_options + 1")]
    InvalidOptionIndex,
}
