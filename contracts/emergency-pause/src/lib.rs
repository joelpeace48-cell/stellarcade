//! Stellarcade Emergency Pause Contract
//!
//! A reusable pause mechanism for halting critical operations during incidents.
//! Can be deployed standalone or used as a library by other contracts.
//!
//! Game and admin contracts should call `require_not_paused` at the top of any
//! sensitive function to fail fast when the platform is paused.
#![no_std]

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String, Vec};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    PauseMetadata,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseMetadata {
    pub reason_code: u32,
    pub timestamp: u64,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedTargetSummary {
    pub target: String,
    pub reason_code: u32,
    pub paused_at: u64,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseWindowSnapshot {
    pub is_paused: bool,
    pub active_target_count: u32,
    pub paused_at: Option<u64>,
    pub reason_code: Option<u32>,
    pub admin: Option<Address>,
    pub window_seconds: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    NotAuthorized      = 3,
    AlreadyPaused      = 4,
    NotPaused          = 5,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct Paused {
    pub admin: Address,
    pub reason_code: u32,
}

#[contractevent]
pub struct Unpaused {
    pub admin: Address,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct EmergencyPause;

#[contractimpl]
impl EmergencyPause {
    /// Initialize with an admin who can pause/unpause. Can only be called once.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    /// Pause the contract with a reason code. Only callable by admin. Errors if already paused.
    pub fn pause(env: Env, admin: Address, reason_code: u32) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        if is_paused_internal(&env) {
            return Err(Error::AlreadyPaused);
        }

        let metadata = PauseMetadata {
            reason_code,
            timestamp: env.ledger().timestamp(),
            admin: admin.clone(),
        };

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().set(&DataKey::PauseMetadata, &metadata);
        
        Paused { admin, reason_code }.publish(&env);
        Ok(())
    }

    /// Unpause the contract. Only callable by admin. Errors if not paused.
    pub fn unpause(env: Env, admin: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        if !is_paused_internal(&env) {
            return Err(Error::NotPaused);
        }

        env.storage().instance().set(&DataKey::Paused, &false);
        Unpaused { admin }.publish(&env);
        Ok(())
    }

    /// Check if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        is_paused_internal(&env)
    }

    /// Get the current or latest pause metadata.
    pub fn get_pause_metadata(env: Env) -> Option<PauseMetadata> {
        env.storage().instance().get(&DataKey::PauseMetadata)
    }

    /// Returns a deterministic list of paused targets.
    /// The current contract only supports a single global pause target.
    pub fn paused_target_summary(env: Env) -> Vec<PausedTargetSummary> {
        let mut targets = Vec::new(&env);

        if let Some(metadata) = current_pause_metadata(&env) {
            targets.push_back(PausedTargetSummary {
                target: String::from_str(&env, "global"),
                reason_code: metadata.reason_code,
                paused_at: metadata.timestamp,
                admin: metadata.admin,
            });
        }

        targets
    }

    /// Returns a side-effect free snapshot of the active pause window.
    pub fn pause_window_snapshot(env: Env) -> PauseWindowSnapshot {
        if let Some(metadata) = current_pause_metadata(&env) {
            let now = env.ledger().timestamp();
            return PauseWindowSnapshot {
                is_paused: true,
                active_target_count: 1,
                paused_at: Some(metadata.timestamp),
                reason_code: Some(metadata.reason_code),
                admin: Some(metadata.admin),
                window_seconds: now.saturating_sub(metadata.timestamp),
            };
        }

        PauseWindowSnapshot {
            is_paused: false,
            active_target_count: 0,
            paused_at: None,
            reason_code: None,
            admin: None,
            window_seconds: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Guard helpers — meant to be used by other contracts importing this crate
// ---------------------------------------------------------------------------

/// Panics if the contract is paused. Call this at the top of any function
/// that should be blocked during an emergency.
///
/// Usage from another contract:
/// ```ignore
/// use stellarcade_emergency_pause::require_not_paused;
/// require_not_paused(&env);
/// ```
pub fn require_not_paused(env: &Env) {
    if is_paused_internal(env) {
        panic!("EmergencyPause: contract is paused");
    }
}

/// Read the pause flag from instance storage.
pub fn is_paused_internal(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

fn current_pause_metadata(env: &Env) -> Option<PauseMetadata> {
    if !is_paused_internal(env) {
        return None;
    }

    env.storage().instance().get(&DataKey::PauseMetadata)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    caller.require_auth();
    if caller != &admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test;
