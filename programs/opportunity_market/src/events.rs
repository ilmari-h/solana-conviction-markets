use anchor_lang::prelude::*;

/// Emits an event with `timestamp` automatically set from `Clock::get()`.
macro_rules! emit_ts {
    ($event:ident { $($field:ident : $value:expr),* $(,)? }) => {{
        let clock = Clock::get()?;
        emit!($event {
            $($field: $value,)*
            timestamp: clock.unix_timestamp,
        });
    }};
}

pub(crate) use emit_ts;

#[event]
pub struct MarketCreatedEvent {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub index: u64,
    pub timestamp: i64,
}

#[event]
pub struct EncryptedTokenWrappedEvent {
    pub encrypted_token_account: Pubkey,
    pub buyer: Pubkey,
    pub lamports_spent: u64,
    pub timestamp: i64,
}

#[event]
pub struct SharesPurchasedEvent {
    pub buyer: Pubkey,
    pub encrypted_disclosed_amount: [u8; 32],
    pub nonce: u128,
    pub timestamp: i64,
}

#[event]
pub struct SharesRevealedEvent {
    pub buyer: Pubkey,
    pub shares_amount: u64,
    pub selected_option: u16,
    pub timestamp: i64,
}

#[event]
pub struct SharesUnstakedEvent {
    pub buyer: Pubkey,
    pub market: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SharesRevealedError {
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SharesPurchasedError {
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SharesUnstakedError {
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EncryptedTokensUnwrappedError {
    pub user: Pubkey,
    pub timestamp: i64,
}
