#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

fn setup(env: &Env) -> (EmergencyPauseClient<'_>, Address, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(EmergencyPause, ());
    let client = EmergencyPauseClient::new(env, &contract_id);

    env.mock_all_auths();
    client.init(&admin);

    (client, admin, contract_id)
}

// -------------------------------------------------------------------
// 1. Initialization
// -------------------------------------------------------------------

#[test]
fn test_init_sets_unpaused() {
    let env = Env::default();
    let (client, _, _) = setup(&env);

    assert!(!client.is_paused());
}

#[test]
fn test_init_rejects_reinit() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    let result = client.try_init(&admin);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 2. Pause / unpause happy path
// -------------------------------------------------------------------

#[test]
fn test_pause_and_unpause() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    let reason_code = 101;
    client.pause(&admin, &reason_code);
    assert!(client.is_paused());

    let metadata = client.get_pause_metadata().unwrap();
    assert_eq!(metadata.reason_code, reason_code);
    assert_eq!(metadata.admin, admin);

    client.unpause(&admin);
    assert!(!client.is_paused());
    
    // Metadata should persist after unpausing (as "latest")
    let persistent_metadata = client.get_pause_metadata().unwrap();
    assert_eq!(persistent_metadata.reason_code, reason_code);
}

// -------------------------------------------------------------------
// 3. Duplicate transitions rejected
// -------------------------------------------------------------------

#[test]
fn test_pause_when_already_paused_errors() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin, &1);
    let result = client.try_pause(&admin, &2);
    assert!(result.is_err());
}

#[test]
fn test_unpause_when_not_paused_errors() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    let result = client.try_unpause(&admin);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 4. Authorization: non-admin cannot pause/unpause
// -------------------------------------------------------------------

#[test]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _admin, _) = setup(&env);
    env.mock_all_auths();

    let stranger = Address::generate(&env);
    let result = client.try_pause(&stranger, &1);
    assert!(result.is_err());
}

#[test]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin, &1);

    let stranger = Address::generate(&env);
    let result = client.try_unpause(&stranger);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 5. require_not_paused guard
// -------------------------------------------------------------------

#[test]
fn test_require_not_paused_passes_when_unpaused() {
    let env = Env::default();
    let (_client, _admin, contract_id) = setup(&env);

    // Must run inside contract context to access instance storage
    env.as_contract(&contract_id, || {
        require_not_paused(&env);
    });
}

#[test]
#[should_panic(expected = "EmergencyPause: contract is paused")]
fn test_require_not_paused_panics_when_paused() {
    let env = Env::default();
    let (client, admin, contract_id) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin, &1);
    env.as_contract(&contract_id, || {
        require_not_paused(&env);
    });
}

// -------------------------------------------------------------------
// 6. Full cycle: pause → unpause → pause again
// -------------------------------------------------------------------

#[test]
fn test_full_pause_cycle() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    assert!(!client.is_paused());

    client.pause(&admin, &1);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());

    // Can pause again after unpausing
    client.pause(&admin, &2);
    assert!(client.is_paused());
    
    let metadata = client.get_pause_metadata().unwrap();
    assert_eq!(metadata.reason_code, 2);
}

// -------------------------------------------------------------------
// 7. Metadata specifics
// -------------------------------------------------------------------

#[test]
fn test_get_metadata_returns_none_initially() {
    let env = Env::default();
    let (client, _, _) = setup(&env);
    
    assert!(client.get_pause_metadata().is_none());
}

#[test]
fn test_paused_target_summary_is_empty_when_unpaused() {
    let env = Env::default();
    let (client, _, _) = setup(&env);

    let summary = client.paused_target_summary();
    assert_eq!(summary.len(), 0);

    let snapshot = client.pause_window_snapshot();
    assert!(!snapshot.is_paused);
    assert_eq!(snapshot.active_target_count, 0);
    assert_eq!(snapshot.window_seconds, 0);
    assert_eq!(snapshot.paused_at, None);
}

#[test]
fn test_pause_window_snapshot_reports_active_pause_window() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000);
    client.pause(&admin, &77);

    env.ledger().set_timestamp(1_045);
    let snapshot = client.pause_window_snapshot();

    assert!(snapshot.is_paused);
    assert_eq!(snapshot.active_target_count, 1);
    assert_eq!(snapshot.paused_at, Some(1_000));
    assert_eq!(snapshot.reason_code, Some(77));
    assert_eq!(snapshot.admin, Some(admin));
    assert_eq!(snapshot.window_seconds, 45);
}

#[test]
fn test_paused_target_summary_reports_global_pause_deterministically() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    env.ledger().set_timestamp(500);
    client.pause(&admin, &9);

    let summary = client.paused_target_summary();
    assert_eq!(summary.len(), 1);

    let target = summary.get(0).expect("summary entry should exist");
    assert_eq!(target.target, soroban_sdk::String::from_str(&env, "global"));
    assert_eq!(target.reason_code, 9);
    assert_eq!(target.paused_at, 500);
    assert_eq!(target.admin, admin);
}
