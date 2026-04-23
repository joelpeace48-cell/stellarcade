use soroban_sdk::{Address, Env, Vec};

use crate::{
    types::{AccrualRecord, PayoutScheduleEntry, RoyaltyConfig},
    DataKey, BUMP_AMOUNT, LIFETIME_THRESHOLD,
};

pub fn get_config(env: &Env, creator: &Address) -> Option<RoyaltyConfig> {
    let key = DataKey::Config(creator.clone());
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    }
    val
}

pub fn set_config(env: &Env, creator: &Address, config: &RoyaltyConfig) {
    let key = DataKey::Config(creator.clone());
    env.storage().persistent().set(&key, config);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn get_accrual(env: &Env, creator: &Address) -> Option<AccrualRecord> {
    let key = DataKey::Accrual(creator.clone());
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    }
    val
}

pub fn set_accrual(env: &Env, creator: &Address, record: &AccrualRecord) {
    let key = DataKey::Accrual(creator.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn get_schedule_entries(env: &Env, creator: &Address) -> Vec<PayoutScheduleEntry> {
    let key = DataKey::ScheduleEntries(creator.clone());
    let val: Option<Vec<PayoutScheduleEntry>> = env.storage().persistent().get(&key);
    match val {
        Some(entries) => {
            env.storage()
                .persistent()
                .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
            entries
        }
        None => Vec::new(env),
    }
}

pub fn set_schedule_entries(env: &Env, creator: &Address, entries: &Vec<PayoutScheduleEntry>) {
    let key = DataKey::ScheduleEntries(creator.clone());
    env.storage().persistent().set(&key, entries);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn get_schedule_interval(env: &Env, creator: &Address) -> u32 {
    let key = DataKey::ScheduleInterval(creator.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn set_schedule_interval(env: &Env, creator: &Address, interval_ledgers: u32) {
    let key = DataKey::ScheduleInterval(creator.clone());
    env.storage().persistent().set(&key, &interval_ledgers);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn get_paid_count(env: &Env, creator: &Address) -> u32 {
    let key = DataKey::PaidCount(creator.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_paid_count(env: &Env, creator: &Address) {
    let key = DataKey::PaidCount(creator.clone());
    let current: u32 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage()
        .persistent()
        .set(&key, &current.saturating_add(1));
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}
