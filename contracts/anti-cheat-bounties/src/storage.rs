use soroban_sdk::{Address, Env, Vec};

use crate::{
    types::{Bounty, Report},
    DataKey, BUMP_AMOUNT, LIFETIME_THRESHOLD,
};

pub fn get_bounty(env: &Env, bounty_id: u64) -> Option<Bounty> {
    let key = DataKey::Bounty(bounty_id);
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    }
    val
}

pub fn set_bounty(env: &Env, bounty: &Bounty) {
    let key = DataKey::Bounty(bounty.bounty_id);
    env.storage().persistent().set(&key, bounty);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn next_bounty_id(env: &Env) -> u64 {
    let current: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextBountyId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextBountyId, &(current + 1));
    current
}

/// Append a report for a bounty; keyed by (bounty_id, reporter).
pub fn add_report(env: &Env, report: &Report) {
    let key = DataKey::Report(report.bounty_id, report.reporter.clone());
    env.storage().persistent().set(&key, report);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    increment_report_count(env, report.bounty_id);
}

pub fn has_report(env: &Env, bounty_id: u64, reporter: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Report(bounty_id, reporter.clone()))
}

pub fn get_report_count(env: &Env, bounty_id: u64) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::ReportCount(bounty_id))
        .unwrap_or(0)
}

fn increment_report_count(env: &Env, bounty_id: u64) {
    let key = DataKey::ReportCount(bounty_id);
    let current: u32 = env.storage().instance().get(&key).unwrap_or(0);
    env.storage()
        .instance()
        .set(&key, &current.saturating_add(1));
}

/// Maintain a list of all bounty IDs for summary queries.
pub fn get_all_ids(env: &Env) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&DataKey::AllIds)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn push_bounty_id(env: &Env, bounty_id: u64) {
    let mut ids = get_all_ids(env);
    ids.push_back(bounty_id);
    env.storage().instance().set(&DataKey::AllIds, &ids);
}
