#![no_std]

use soroban_sdk::{contracttype, Address, Env, String, Vec};

// Types for season-pass contract

#[contracttype]
pub struct Entitlement {
    pub user: Address,
    pub entitlement_type: String,
    pub amount: i128,
}

#[contracttype]
pub struct EntitlementSnapshot {
    pub entitlements: Vec<Entitlement>,
    pub total_entitlements: u32,
}

#[contracttype]
pub struct TierProgress {
    pub user: Address,
    pub current_tier: u32,
    pub progress: u32,
    pub next_tier_threshold: u32,
}