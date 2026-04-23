#![no_std]

use soroban_sdk::{contracttype, Address, Env};

use crate::types::*;

// Storage keys

#[contracttype]
pub enum DataKey {
    Admin,
    Entitlements(Address), // per user entitlements
    TierProgress(Address), // per user tier progress
}

// Storage functions

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_entitlements(env: &Env, user: &Address) -> Vec<Entitlement> {
    env.storage().persistent().get(&DataKey::Entitlements(user.clone())).unwrap_or(Vec::new(&env))
}

pub fn set_entitlements(env: &Env, user: &Address, entitlements: &Vec<Entitlement>) {
    env.storage().persistent().set(&DataKey::Entitlements(user.clone()), entitlements);
    env.storage().persistent().bump(&DataKey::Entitlements(user.clone()), 518400);
}

pub fn get_tier_progress(env: &Env, user: &Address) -> Option<TierProgress> {
    env.storage().persistent().get(&DataKey::TierProgress(user.clone()))
}

pub fn set_tier_progress(env: &Env, user: &Address, progress: &TierProgress) {
    env.storage().persistent().set(&DataKey::TierProgress(user.clone()), progress);
    env.storage().persistent().bump(&DataKey::TierProgress(user.clone()), 518400);
}