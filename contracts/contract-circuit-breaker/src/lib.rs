#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address,
    Env,
};

// ---------------------------------------------------------------------------
// TTL / storage constants
// ---------------------------------------------------------------------------

const PERSISTENT_BUMP_LEDGERS: u32 = 518_400; // ~30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = PERSISTENT_BUMP_LEDGERS - 100_800; // Renew ~7 days early

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidThreshold = 4,
    BreakerNotFound = 5,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum BreakerStatus {
    Closed = 0, // Normal operation
    Open = 1,   // Tripped
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BreakerData {
    pub failure_count: u32,
    pub status: BreakerStatus,
    pub last_failure_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Threshold,
    Breaker(Address), // Keyed by contract_id
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct ContractInitialized {
    pub admin: Address,
    pub threshold: u32,
}

#[contractevent]
pub struct FailureRecorded {
    pub contract_id: Address,
    pub failure_count: u32,
    pub status: BreakerStatus,
}

#[contractevent]
pub struct BreakerTripped {
    pub contract_id: Address,
}

#[contractevent]
pub struct BreakerReset {
    pub contract_id: Address,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct ContractCircuitBreaker;

#[contractimpl]
impl ContractCircuitBreaker {
    /// Initialise the circuit breaker contract.
    pub fn init(env: Env, admin: Address, threshold: u32) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        if threshold == 0 {
            return Err(Error::InvalidThreshold);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Threshold, &threshold);

        ContractInitialized { admin, threshold }.publish(&env);

        Ok(())
    }

    /// Record a failure for a specific contract.
    /// In production, this would likely be restricted to authorized callers (monitors).
    pub fn record_failure(env: Env, contract_id: Address, _code: u32) -> Result<(), Error> {
        // For security, only Admin or an authorized role should call this.
        // For simplicity in this base version, we use Admin.
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let threshold: u32 = env.storage().instance().get(&DataKey::Threshold).unwrap();
        let key = DataKey::Breaker(contract_id.clone());
        
        let mut data: BreakerData = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(BreakerData {
                failure_count: 0,
                status: BreakerStatus::Closed,
                last_failure_ledger: 0,
            });

        // Only increment if already closed
        if data.status == BreakerStatus::Closed {
            data.failure_count += 1;
            data.last_failure_ledger = env.ledger().sequence();

            if data.failure_count >= threshold {
                data.status = BreakerStatus::Open;
                BreakerTripped { contract_id: contract_id.clone() }.publish(&env);
            }
        }

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_BUMP_LEDGERS,
        );

        FailureRecorded {
            contract_id,
            failure_count: data.failure_count,
            status: data.status,
        }
        .publish(&env);

        Ok(())
    }

    /// Manually trip the circuit breaker for a contract.
    pub fn trip(env: Env, contract_id: Address) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Breaker(contract_id.clone());
        let mut data: BreakerData = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(BreakerData {
                failure_count: 0,
                status: BreakerStatus::Closed,
                last_failure_ledger: 0,
            });

        data.status = BreakerStatus::Open;
        env.storage().persistent().set(&key, &data);
        
        BreakerTripped { contract_id }.publish(&env);

        Ok(())
    }

    /// Reset the circuit breaker for a contract to Closed state.
    pub fn reset(env: Env, contract_id: Address) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Breaker(contract_id.clone());
        let data = BreakerData {
            failure_count: 0,
            status: BreakerStatus::Closed,
            last_failure_ledger: 0,
        };

        env.storage().persistent().set(&key, &data);
        
        BreakerReset { contract_id }.publish(&env);

        Ok(())
    }

    /// Query the current state of a circuit breaker.
    pub fn breaker_state(env: Env, contract_id: Address) -> Option<BreakerData> {
        env.storage().persistent().get(&DataKey::Breaker(contract_id))
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn require_admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// #[cfg(test)]
// mod test {
//     use super::*;
//     use soroban_sdk::{testutils::Address as _, Address, Env};

//     struct Setup<'a> {
//         env: Env,
//         client: ContractCircuitBreakerClient<'a>,
//         _admin: Address,
//     }

//     fn setup() -> Setup<'static> {
//         let env = Env::default();
//         env.mock_all_auths();

//         let contract_id = env.register(ContractCircuitBreaker, ());
//         let client = ContractCircuitBreakerClient::new(&env, &contract_id);

//         let admin = Address::generate(&env);
//         client.init(&admin, &3);

//         let client: ContractCircuitBreakerClient<'static> = unsafe { core::mem::transmute(client) };

//         Setup {
//             env,
//             client,
//             admin,
//         }
//     }

//     #[test]
//     fn test_init() {
//         let _s = setup();
//     }

//     #[test]
//     fn test_automatic_tripping() {
//         let s = setup();
//         let target = Address::generate(&s.env);

//         // First failure
//         s.client.record_failure(&target, &1);
//         let state = s.client.breaker_state(&target).unwrap();
//         assert_eq!(state.failure_count, 1);
//         assert_eq!(state.status, BreakerStatus::Closed);

//         // Second failure
//         s.client.record_failure(&target, &1);
//         let state = s.client.breaker_state(&target).unwrap();
//         assert_eq!(state.failure_count, 2);
//         assert_eq!(state.status, BreakerStatus::Closed);

//         // Third failure - trips
//         s.client.record_failure(&target, &1);
//         let state = s.client.breaker_state(&target).unwrap();
//         assert_eq!(state.failure_count, 3);
//         assert_eq!(state.status, BreakerStatus::Open);
//     }

//     #[test]
//     fn test_manual_trip_and_reset() {
//         let s = setup();
//         let target = Address::generate(&s.env);

//         s.client.trip(&target);
//         assert_eq!(s.client.breaker_state(&target).unwrap().status, BreakerStatus::Open);

//         s.client.reset(&target);
//         let state = s.client.breaker_state(&target).unwrap();
//         assert_eq!(state.status, BreakerStatus::Closed);
//         assert_eq!(state.failure_count, 0);
//     }
// }
