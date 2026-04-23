#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Env as _};
use soroban_sdk::{vec, Address, Env, String};

#[test]
fn test_get_entitlement_snapshot() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SeasonPassContract);
    let client = SeasonPassContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let ent = Entitlement {
        user: user.clone(),
        entitlement_type: String::from_str(&env, "bonus"),
        amount: 100,
    };
    client.add_entitlement(&user, &ent);

    let snapshot = client.get_entitlement_snapshot(&user);
    assert_eq!(snapshot.total_entitlements, 1);
    assert_eq!(snapshot.entitlements.len(), 1);
}

#[test]
fn test_get_tier_progress_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SeasonPassContract);
    let client = SeasonPassContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let progress = client.get_tier_progress(&user);
    assert!(progress.is_none());
}