#![no_std]

mod storage;
mod types;

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, Vec};

pub use types::{
    AccrualRecord, AccrualSummary, PayoutSchedule, PayoutScheduleEntry, RoyaltyConfig,
};

// ~30 days at 5 s/ledger
const BUMP_AMOUNT: u32 = 518_400;
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT / 2;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Config(Address),
    Accrual(Address),
    ScheduleEntries(Address),
    ScheduleInterval(Address),
    PaidCount(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    ConfigNotFound = 4,
    AlreadyConfigured = 5,
    InvalidRateBps = 6,
    InvalidAmount = 7,
    Overflow = 8,
    NoPendingBalance = 9,
    ScheduleNotFound = 10,
    TooEarlyToClaim = 11,
    NothingToClaim = 12,
}

#[contract]
pub struct CreatorRoyalties;

#[contractimpl]
impl CreatorRoyalties {
    // ── Admin ──────────────────────────────────────────────────────────────────

    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    fn require_admin(env: &Env) -> Result<Address, Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        Ok(admin)
    }

    // ── Creator config ─────────────────────────────────────────────────────────

    /// Register or update the royalty rate for a creator's asset.
    /// `rate_bps` must be in 0..=10_000.
    pub fn configure(
        env: Env,
        creator: Address,
        rate_bps: u32,
        token: Address,
    ) -> Result<(), Error> {
        creator.require_auth();
        if rate_bps > 10_000 {
            return Err(Error::InvalidRateBps);
        }
        let config = RoyaltyConfig {
            creator: creator.clone(),
            rate_bps,
            token,
            active: true,
        };
        storage::set_config(&env, &creator, &config);
        Ok(())
    }

    // ── Accrual ────────────────────────────────────────────────────────────────

    /// Record royalties accrued on behalf of a creator (admin-only).
    /// Typically called by the platform after each qualifying sale.
    pub fn record_accrual(env: Env, creator: Address, amount: i128) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let config = storage::get_config(&env, &creator).ok_or(Error::ConfigNotFound)?;
        let mut record = storage::get_accrual(&env, &creator).unwrap_or(AccrualRecord {
            creator: creator.clone(),
            token: config.token.clone(),
            total_accrued: 0,
            total_paid: 0,
            pending: 0,
            accrual_count: 0,
        });
        record.total_accrued = record
            .total_accrued
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        record.pending = record
            .total_accrued
            .checked_sub(record.total_paid)
            .ok_or(Error::Overflow)?;
        record.accrual_count = record.accrual_count.saturating_add(1);
        storage::set_accrual(&env, &creator, &record);
        Ok(())
    }

    // ── Payout schedule ────────────────────────────────────────────────────────

    /// Set the minimum interval (in ledgers) between payouts for a creator.
    /// Must be called by the creator.
    pub fn set_payout_interval(
        env: Env,
        creator: Address,
        interval_ledgers: u32,
    ) -> Result<(), Error> {
        creator.require_auth();
        storage::get_config(&env, &creator).ok_or(Error::ConfigNotFound)?;
        storage::set_schedule_interval(&env, &creator, interval_ledgers);
        Ok(())
    }

    /// Queue a scheduled payout entry (admin-only).
    pub fn schedule_payout(
        env: Env,
        creator: Address,
        claimable_at_ledger: u32,
        amount: i128,
    ) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        storage::get_config(&env, &creator).ok_or(Error::ConfigNotFound)?;
        let mut entries = storage::get_schedule_entries(&env, &creator);
        entries.push_back(PayoutScheduleEntry {
            claimable_at_ledger,
            amount,
            claimed: false,
        });
        storage::set_schedule_entries(&env, &creator, &entries);
        Ok(())
    }

    /// Claim all schedule entries whose `claimable_at_ledger` has passed.
    /// Must be called by the creator.
    pub fn claim_scheduled(env: Env, creator: Address) -> Result<i128, Error> {
        creator.require_auth();
        let current_ledger = env.ledger().sequence();
        let entries = storage::get_schedule_entries(&env, &creator);
        if entries.is_empty() {
            return Err(Error::ScheduleNotFound);
        }

        let mut total_claimed: i128 = 0;
        let mut updated: Vec<PayoutScheduleEntry> = Vec::new(&env);
        for entry in entries.iter() {
            if !entry.claimed && entry.claimable_at_ledger <= current_ledger {
                total_claimed = total_claimed
                    .checked_add(entry.amount)
                    .ok_or(Error::Overflow)?;
                updated.push_back(PayoutScheduleEntry {
                    claimed: true,
                    ..entry
                });
                storage::increment_paid_count(&env, &creator);
            } else {
                updated.push_back(entry);
            }
        }

        if total_claimed == 0 {
            return Err(Error::NothingToClaim);
        }

        // Update accrual record
        if let Some(mut record) = storage::get_accrual(&env, &creator) {
            record.total_paid = record
                .total_paid
                .checked_add(total_claimed)
                .ok_or(Error::Overflow)?;
            record.pending = record
                .total_accrued
                .checked_sub(record.total_paid)
                .ok_or(Error::Overflow)?;
            storage::set_accrual(&env, &creator, &record);
        }

        storage::set_schedule_entries(&env, &creator, &updated);
        Ok(total_claimed)
    }

    // ── Read-only accessors ────────────────────────────────────────────────────

    /// Returns a full accrual summary for a creator.
    /// Returns an empty/zero summary when the creator is not configured.
    pub fn accrual_summary(env: Env, creator: Address) -> AccrualSummary {
        let config_opt = storage::get_config(&env, &creator);
        let accrual_opt = storage::get_accrual(&env, &creator);

        match config_opt {
            Some(config) => {
                let record = accrual_opt.unwrap_or(AccrualRecord {
                    creator: creator.clone(),
                    token: config.token.clone(),
                    total_accrued: 0,
                    total_paid: 0,
                    pending: 0,
                    accrual_count: 0,
                });
                AccrualSummary {
                    creator,
                    exists: true,
                    rate_bps: config.rate_bps,
                    token: config.token,
                    total_accrued: record.total_accrued,
                    total_paid: record.total_paid,
                    pending: record.pending,
                    accrual_count: record.accrual_count,
                }
            }
            None => AccrualSummary {
                creator: creator.clone(),
                exists: false,
                rate_bps: 0,
                token: creator, // placeholder — consumers must check `exists`
                total_accrued: 0,
                total_paid: 0,
                pending: 0,
                accrual_count: 0,
            },
        }
    }

    /// Returns the payout schedule for a creator.
    /// Returns an empty schedule when none has been set up.
    pub fn payout_schedule(env: Env, creator: Address) -> PayoutSchedule {
        let config_opt = storage::get_config(&env, &creator);
        if config_opt.is_none() {
            return PayoutSchedule {
                creator,
                exists: false,
                interval_ledgers: 0,
                pending_entries: Vec::new(&env),
                paid_count: 0,
            };
        }

        let interval = storage::get_schedule_interval(&env, &creator);
        let all_entries = storage::get_schedule_entries(&env, &creator);
        let paid_count = storage::get_paid_count(&env, &creator);

        let mut pending_entries: Vec<PayoutScheduleEntry> = Vec::new(&env);
        for entry in all_entries.iter() {
            if !entry.claimed {
                pending_entries.push_back(entry);
            }
        }

        PayoutSchedule {
            creator,
            exists: true,
            interval_ledgers: interval,
            pending_entries,
            paid_count,
        }
    }
}

#[cfg(test)]
mod test;
