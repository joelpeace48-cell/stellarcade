//! Stellarcade Streak Bonus Contract
//!
//! Tracks user activity streaks and allows claiming bonuses when streak thresholds
//! are met. Admin sets reward contract and rules; users record activity and claim.
#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Symbol,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    RewardContract,
    Rules,
    UserData(Address),
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreakRules {
    pub min_streak_to_claim: u32,
    pub reward_per_streak: i128,
    /// Max seconds between activities to count as same streak (e.g. 86400 = 24h).
    pub streak_window_secs: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserStreakData {
    pub last_activity_ts: u64,
    pub current_streak: u32,
    pub last_claimed_streak: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StreakSummaryStatus {
    Missing = 0,
    Active = 1,
    Reset = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreakSummary {
    pub status: StreakSummaryStatus,
    pub active_streak: u32,
    pub last_recorded_streak: u32,
    pub last_claimed_streak: u32,
    pub last_activity_ts: u64,
    pub streak_window_ends_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NextBonusPreview {
    pub status: StreakSummaryStatus,
    pub active_streak: u32,
    pub threshold_streak: u32,
    pub streaks_needed: u32,
    pub projected_reward: i128,
    pub claimable_now: bool,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidConfig = 4,
    NothingToClaim = 5,
    Overflow = 6,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct Initialized {
    pub admin: Address,
    pub reward_contract: Address,
}

#[contractevent]
pub struct ActivityRecorded {
    #[topic]
    pub user: Address,
    pub activity_type: Symbol,
    pub ts: u64,
    pub new_streak: u32,
}

#[contractevent]
pub struct StreakBonusClaimed {
    #[topic]
    pub user: Address,
    pub streak: u32,
    pub amount: i128,
}

#[contractevent]
pub struct RulesReset {
    pub min_streak_to_claim: u32,
    pub reward_per_streak: i128,
    pub streak_window_secs: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct StreakBonus;

#[contractimpl]
impl StreakBonus {
    /// Initialize with admin and reward contract address. Call once.
    pub fn init(env: Env, admin: Address, reward_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RewardContract, &reward_contract);
        let default_rules = StreakRules {
            min_streak_to_claim: 3,
            reward_per_streak: 1_000_000i128, // e.g. 1 unit in 6 decimals
            streak_window_secs: 86400,        // 24h
        };
        env.storage()
            .instance()
            .set(&DataKey::Rules, &default_rules);
        Initialized {
            admin,
            reward_contract,
        }
        .publish(&env);
        Ok(())
    }

    /// Record an activity for a user. Caller must be the user (require_auth) or admin.
    pub fn record_activity(
        env: Env,
        caller: Address,
        user: Address,
        activity_type: Symbol,
        ts: u64,
    ) -> Result<u32, Error> {
        caller.require_auth();
        require_admin_or_self(&env, &caller, &user)?;

        let rules: StreakRules = env
            .storage()
            .instance()
            .get(&DataKey::Rules)
            .ok_or(Error::NotInitialized)?;

        let key = DataKey::UserData(user.clone());
        let mut data: UserStreakData =
            env.storage()
                .instance()
                .get(&key)
                .unwrap_or(UserStreakData {
                    last_activity_ts: 0,
                    current_streak: 0,
                    last_claimed_streak: 0,
                });

        let new_streak = if data.last_activity_ts == 0 {
            1u32
        } else if ts > data.last_activity_ts
            && ts.saturating_sub(data.last_activity_ts) <= rules.streak_window_secs
        {
            data.current_streak.checked_add(1).ok_or(Error::Overflow)?
        } else {
            1u32
        };

        data.last_activity_ts = ts;
        data.current_streak = new_streak;
        env.storage().instance().set(&key, &data);

        ActivityRecorded {
            user: user.clone(),
            activity_type,
            ts,
            new_streak,
        }
        .publish(&env);
        Ok(new_streak)
    }

    /// Return the current streak count for a user.
    pub fn current_streak(env: Env, user: Address) -> u32 {
        let key = DataKey::UserData(user);
        env.storage()
            .instance()
            .get(&key)
            .map(|d: UserStreakData| d.current_streak)
            .unwrap_or(0)
    }

    /// Return a UI-friendly summary of a player's streak at `as_of_ts`.
    ///
    /// Missing players return a zeroed summary with `status = Missing`.
    /// Players whose latest activity window has elapsed return `status = Reset`
    /// with `active_streak = 0` while preserving the last recorded streak.
    pub fn streak_summary(env: Env, user: Address, as_of_ts: u64) -> StreakSummary {
        let Some(rules) = read_rules(&env) else {
            return empty_streak_summary();
        };

        build_streak_summary(&env, &user, &rules, as_of_ts)
    }

    /// Preview the next streak bonus target for a player at `as_of_ts`.
    ///
    /// The preview is side-effect free and uses the effective active streak,
    /// making reset streaks render as `active_streak = 0`.
    pub fn next_bonus_preview(env: Env, user: Address, as_of_ts: u64) -> NextBonusPreview {
        let Some(rules) = read_rules(&env) else {
            return NextBonusPreview {
                status: StreakSummaryStatus::Missing,
                active_streak: 0,
                threshold_streak: 0,
                streaks_needed: 0,
                projected_reward: 0,
                claimable_now: false,
            };
        };

        let summary = build_streak_summary(&env, &user, &rules, as_of_ts);
        let next_unclaimed_streak = summary.last_claimed_streak.saturating_add(1);
        let threshold_streak = if next_unclaimed_streak > rules.min_streak_to_claim {
            next_unclaimed_streak
        } else {
            rules.min_streak_to_claim
        };

        let preview_threshold = if summary.active_streak >= threshold_streak {
            summary.active_streak
        } else {
            threshold_streak
        };

        NextBonusPreview {
            status: summary.status,
            active_streak: summary.active_streak,
            threshold_streak: preview_threshold,
            streaks_needed: preview_threshold.saturating_sub(summary.active_streak),
            projected_reward: (preview_threshold as i128).saturating_mul(rules.reward_per_streak),
            claimable_now: summary.active_streak >= rules.min_streak_to_claim
                && summary.active_streak > summary.last_claimed_streak,
        }
    }

    /// Claim streak bonus for the current streak. User must authorize. Updates last_claimed_streak.
    pub fn claim_streak_bonus(env: Env, user: Address) -> Result<i128, Error> {
        user.require_auth();

        let rules: StreakRules = env
            .storage()
            .instance()
            .get(&DataKey::Rules)
            .ok_or(Error::NotInitialized)?;

        let key = DataKey::UserData(user.clone());
        let mut data: UserStreakData = env
            .storage()
            .instance()
            .get(&key)
            .ok_or(Error::NothingToClaim)?;

        if data.current_streak < rules.min_streak_to_claim {
            return Err(Error::NothingToClaim);
        }
        if data.current_streak <= data.last_claimed_streak {
            return Err(Error::NothingToClaim);
        }

        let amount = (data.current_streak as i128)
            .checked_mul(rules.reward_per_streak)
            .ok_or(Error::Overflow)?;

        data.last_claimed_streak = data.current_streak;
        env.storage().instance().set(&key, &data);

        StreakBonusClaimed {
            user: user.clone(),
            streak: data.current_streak,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    /// Reset streak rules. Admin only.
    pub fn reset_rules(env: Env, admin: Address, config: StreakRules) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        if config.streak_window_secs == 0 {
            return Err(Error::InvalidConfig);
        }
        env.storage().instance().set(&DataKey::Rules, &config);
        RulesReset {
            min_streak_to_claim: config.min_streak_to_claim,
            reward_per_streak: config.reward_per_streak,
            streak_window_secs: config.streak_window_secs,
        }
        .publish(&env);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    if *caller != admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn require_admin_or_self(env: &Env, caller: &Address, user: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    if caller != user && *caller != admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn read_rules(env: &Env) -> Option<StreakRules> {
    env.storage().instance().get(&DataKey::Rules)
}

fn empty_streak_summary() -> StreakSummary {
    StreakSummary {
        status: StreakSummaryStatus::Missing,
        active_streak: 0,
        last_recorded_streak: 0,
        last_claimed_streak: 0,
        last_activity_ts: 0,
        streak_window_ends_at: 0,
    }
}

fn build_streak_summary(
    env: &Env,
    user: &Address,
    rules: &StreakRules,
    as_of_ts: u64,
) -> StreakSummary {
    let key = DataKey::UserData(user.clone());
    let Some(data) = env
        .storage()
        .instance()
        .get::<DataKey, UserStreakData>(&key)
    else {
        return empty_streak_summary();
    };

    let streak_window_ends_at = data
        .last_activity_ts
        .saturating_add(rules.streak_window_secs);
    let streak_is_active = data.last_activity_ts > 0 && as_of_ts <= streak_window_ends_at;

    StreakSummary {
        status: if streak_is_active {
            StreakSummaryStatus::Active
        } else {
            StreakSummaryStatus::Reset
        },
        active_streak: if streak_is_active {
            data.current_streak
        } else {
            0
        },
        last_recorded_streak: data.current_streak,
        last_claimed_streak: data.last_claimed_streak,
        last_activity_ts: data.last_activity_ts,
        streak_window_ends_at,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test;
