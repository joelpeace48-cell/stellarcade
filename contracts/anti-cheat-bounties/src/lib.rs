#![no_std]

mod storage;
mod types;

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, Symbol};

pub use types::{
    AdjudicationReadiness, Bounty, BountyStatus, OpenBountySummary, Report,
};

const BUMP_AMOUNT: u32 = 518_400;
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT / 2;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    NextBountyId,
    AllIds,
    Bounty(u64),
    Report(u64, Address),
    ReportCount(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    BountyNotFound = 4,
    BountyNotOpen = 5,
    InvalidReward = 6,
    InvalidDeadline = 7,
    Overflow = 8,
    DeadlinePassed = 9,
    AlreadyReported = 10,
    InvalidMinReporters = 11,
}

#[contract]
pub struct AntiCheatBounties;

#[contractimpl]
impl AntiCheatBounties {
    // ── Admin ──────────────────────────────────────────────────────────────────

    pub fn init(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
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

    // ── Bounty lifecycle ───────────────────────────────────────────────────────

    /// Post a new anti-cheat bounty. The platform funds the reward on-chain.
    pub fn post_bounty(
        env: Env,
        poster: Address,
        game_id: Symbol,
        reward: i128,
        min_reporters: u32,
        report_deadline_ledger: u32,
    ) -> Result<u64, Error> {
        poster.require_auth();
        if reward <= 0 {
            return Err(Error::InvalidReward);
        }
        if min_reporters == 0 {
            return Err(Error::InvalidMinReporters);
        }
        let current_ledger = env.ledger().sequence();
        if report_deadline_ledger <= current_ledger {
            return Err(Error::InvalidDeadline);
        }

        let bounty_id = storage::next_bounty_id(&env);
        let bounty = Bounty {
            bounty_id,
            poster,
            game_id,
            reward,
            min_reporters,
            report_deadline_ledger,
            status: BountyStatus::Open,
        };
        storage::set_bounty(&env, &bounty);
        storage::push_bounty_id(&env, bounty_id);
        Ok(bounty_id)
    }

    /// Submit a cheat report against an open bounty.
    /// Each address can report at most once per bounty.
    pub fn submit_report(
        env: Env,
        reporter: Address,
        bounty_id: u64,
        evidence_hash: Symbol,
    ) -> Result<(), Error> {
        reporter.require_auth();
        let bounty = storage::get_bounty(&env, bounty_id).ok_or(Error::BountyNotFound)?;
        if bounty.status != BountyStatus::Open {
            return Err(Error::BountyNotOpen);
        }
        let current_ledger = env.ledger().sequence();
        if current_ledger > bounty.report_deadline_ledger {
            return Err(Error::DeadlinePassed);
        }
        if storage::has_report(&env, bounty_id, &reporter) {
            return Err(Error::AlreadyReported);
        }

        let report = Report {
            bounty_id,
            reporter,
            evidence_hash,
            submitted_at_ledger: current_ledger,
        };
        storage::add_report(&env, &report);
        Ok(())
    }

    /// Move a bounty to UnderReview (admin-only).
    pub fn begin_adjudication(env: Env, bounty_id: u64) -> Result<(), Error> {
        Self::require_admin(&env)?;
        let mut bounty = storage::get_bounty(&env, bounty_id).ok_or(Error::BountyNotFound)?;
        if bounty.status != BountyStatus::Open {
            return Err(Error::BountyNotOpen);
        }
        bounty.status = BountyStatus::UnderReview;
        storage::set_bounty(&env, &bounty);
        Ok(())
    }

    /// Award or close a bounty (admin-only).
    pub fn resolve_bounty(env: Env, bounty_id: u64, award: bool) -> Result<(), Error> {
        Self::require_admin(&env)?;
        let mut bounty = storage::get_bounty(&env, bounty_id).ok_or(Error::BountyNotFound)?;
        if bounty.status != BountyStatus::UnderReview {
            return Err(Error::BountyNotOpen);
        }
        bounty.status = if award {
            BountyStatus::Awarded
        } else {
            BountyStatus::Closed
        };
        storage::set_bounty(&env, &bounty);
        Ok(())
    }

    // ── Read-only accessors ────────────────────────────────────────────────────

    /// Returns a summary of all open bounties and the total open reward pool.
    pub fn open_bounty_summary(env: Env) -> OpenBountySummary {
        let current_ledger = env.ledger().sequence();
        let ids = storage::get_all_ids(&env);

        let mut open_count: u64 = 0;
        let mut under_review_count: u64 = 0;
        let mut total_open_reward: i128 = 0;

        for id in ids.iter() {
            if let Some(bounty) = storage::get_bounty(&env, id) {
                match bounty.status {
                    BountyStatus::Open => {
                        open_count = open_count.saturating_add(1);
                        total_open_reward =
                            total_open_reward.saturating_add(bounty.reward);
                    }
                    BountyStatus::UnderReview => {
                        under_review_count = under_review_count.saturating_add(1);
                    }
                    _ => {}
                }
            }
        }

        OpenBountySummary {
            open_count,
            under_review_count,
            total_open_reward,
            current_ledger,
        }
    }

    /// Returns adjudication-readiness details for a single bounty.
    /// Returns a not-found struct when the bounty_id is unknown.
    pub fn adjudication_readiness(env: Env, bounty_id: u64) -> AdjudicationReadiness {
        let current_ledger = env.ledger().sequence();
        match storage::get_bounty(&env, bounty_id) {
            Some(bounty) => {
                let report_count = storage::get_report_count(&env, bounty_id);
                let has_enough_reports = report_count >= bounty.min_reporters;
                let deadline_passed = current_ledger > bounty.report_deadline_ledger;
                let ready_to_adjudicate = has_enough_reports
                    && deadline_passed
                    && bounty.status == BountyStatus::Open;
                AdjudicationReadiness {
                    bounty_id,
                    exists: true,
                    status: bounty.status,
                    report_count,
                    min_reporters: bounty.min_reporters,
                    has_enough_reports,
                    deadline_passed,
                    ready_to_adjudicate,
                    current_ledger,
                }
            }
            None => AdjudicationReadiness {
                bounty_id,
                exists: false,
                status: BountyStatus::Closed,
                report_count: 0,
                min_reporters: 0,
                has_enough_reports: false,
                deadline_passed: false,
                ready_to_adjudicate: false,
                current_ledger,
            },
        }
    }
}

#[cfg(test)]
mod test;
