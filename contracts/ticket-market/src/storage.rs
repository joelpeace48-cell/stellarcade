use soroban_sdk::{Env, Vec};

use crate::{types::Listing, DataKey, BUMP_AMOUNT, LIFETIME_THRESHOLD};

pub fn get_listing(env: &Env, listing_id: u64) -> Option<Listing> {
    let key = DataKey::Listing(listing_id);
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
    }
    val
}

pub fn set_listing(env: &Env, listing: &Listing) {
    let key = DataKey::Listing(listing.listing_id);
    env.storage().persistent().set(&key, listing);
    env.storage()
        .persistent()
        .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

pub fn next_listing_id(env: &Env) -> u64 {
    let current: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextListingId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextListingId, &(current + 1));
    current
}

/// Track active listing IDs for orderbook queries.
pub fn get_active_ids(env: &Env) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&DataKey::ActiveIds)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn add_active_id(env: &Env, listing_id: u64) {
    let mut ids = get_active_ids(env);
    ids.push_back(listing_id);
    env.storage().instance().set(&DataKey::ActiveIds, &ids);
}

/// Remove a listing ID from the active set.
pub fn remove_active_id(env: &Env, listing_id: u64) {
    let ids = get_active_ids(env);
    let mut updated: Vec<u64> = Vec::new(env);
    for id in ids.iter() {
        if id != listing_id {
            updated.push_back(id);
        }
    }
    env.storage().instance().set(&DataKey::ActiveIds, &updated);
}
