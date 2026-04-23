#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

mod storage;
mod types;

use storage::*;
use types::*;

// Contract

#[contract]
pub struct SeasonPassContract;

#[contractimpl]
impl SeasonPassContract {
    // Initialize the contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        set_admin(&env, &admin);
    }

    // Accessor for entitlement snapshot
    pub fn get_entitlement_snapshot(env: Env, user: Address) -> EntitlementSnapshot {
        let entitlements = get_entitlements(&env, &user);
        EntitlementSnapshot {
            entitlements,
            total_entitlements: entitlements.len(),
        }
    }

    // Accessor for tier progress
    pub fn get_tier_progress(env: Env, user: Address) -> Option<TierProgress> {
        get_tier_progress(&env, &user)
    }

    // Some write functions for completeness
    pub fn add_entitlement(env: Env, user: Address, entitlement: Entitlement) {
        let mut ents = get_entitlements(&env, &user);
        ents.push_back(entitlement);
        set_entitlements(&env, &user, &ents);
    }

    pub fn set_tier_progress(env: Env, user: Address, progress: TierProgress) {
        set_tier_progress(&env, &user, &progress);
    }
}