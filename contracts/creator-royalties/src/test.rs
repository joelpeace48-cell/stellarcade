use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup(env: &Env) -> (CreatorRoyaltiesClient<'_>, Address, Address, Address) {
    let admin = Address::generate(env);
    let creator = Address::generate(env);
    let token = Address::generate(env);
    let contract_id = env.register_contract(None, CreatorRoyalties);
    let client = CreatorRoyaltiesClient::new(env, &contract_id);
    client.init(&admin);
    (client, admin, creator, token)
}

// ── accrual_summary ────────────────────────────────────────────────────────────

#[test]
fn test_accrual_summary_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &500, &token);
    client.record_accrual(&creator, &1_000_000);
    client.record_accrual(&creator, &500_000);

    let summary = client.accrual_summary(&creator);
    assert!(summary.exists);
    assert_eq!(summary.rate_bps, 500);
    assert_eq!(summary.total_accrued, 1_500_000);
    assert_eq!(summary.total_paid, 0);
    assert_eq!(summary.pending, 1_500_000);
    assert_eq!(summary.accrual_count, 2);
}

#[test]
fn test_accrual_summary_unknown_creator_returns_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _creator, _token) = setup(&env);
    let unknown = Address::generate(&env);

    let summary = client.accrual_summary(&unknown);
    assert!(!summary.exists);
    assert_eq!(summary.total_accrued, 0);
    assert_eq!(summary.pending, 0);
    assert_eq!(summary.accrual_count, 0);
}

#[test]
fn test_accrual_summary_configured_but_no_accruals() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &250, &token);

    let summary = client.accrual_summary(&creator);
    assert!(summary.exists);
    assert_eq!(summary.total_accrued, 0);
    assert_eq!(summary.pending, 0);
    assert_eq!(summary.accrual_count, 0);
}

// ── payout_schedule ────────────────────────────────────────────────────────────

#[test]
fn test_payout_schedule_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &500, &token);
    client.set_payout_interval(&creator, &1_000);
    client.schedule_payout(&creator, &100, &200_000);
    client.schedule_payout(&creator, &200, &300_000);

    let schedule = client.payout_schedule(&creator);
    assert!(schedule.exists);
    assert_eq!(schedule.interval_ledgers, 1_000);
    assert_eq!(schedule.pending_entries.len(), 2);
    assert_eq!(schedule.paid_count, 0);

    let first = schedule.pending_entries.get(0).unwrap();
    assert_eq!(first.claimable_at_ledger, 100);
    assert_eq!(first.amount, 200_000);
    assert!(!first.claimed);
}

#[test]
fn test_payout_schedule_unknown_creator_returns_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _creator, _token) = setup(&env);
    let unknown = Address::generate(&env);

    let schedule = client.payout_schedule(&unknown);
    assert!(!schedule.exists);
    assert_eq!(schedule.pending_entries.len(), 0);
    assert_eq!(schedule.paid_count, 0);
}

#[test]
fn test_payout_schedule_no_entries_configured() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &500, &token);

    let schedule = client.payout_schedule(&creator);
    assert!(schedule.exists);
    assert_eq!(schedule.pending_entries.len(), 0);
    assert_eq!(schedule.paid_count, 0);
}

// ── claim_scheduled ───────────────────────────────────────────────────────────

#[test]
fn test_claim_scheduled_moves_entries_to_paid() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &500, &token);
    client.record_accrual(&creator, &1_000_000);
    // claimable_at_ledger=1 is in the past relative to ledger sequence 0
    client.schedule_payout(&creator, &1, &400_000);
    client.schedule_payout(&creator, &999_999, &600_000); // future

    let claimed = client.claim_scheduled(&creator);
    assert_eq!(claimed, 400_000);

    let schedule = client.payout_schedule(&creator);
    // Only the future entry remains pending
    assert_eq!(schedule.pending_entries.len(), 1);
    assert_eq!(schedule.paid_count, 1);

    let summary = client.accrual_summary(&creator);
    assert_eq!(summary.total_paid, 400_000);
    assert_eq!(summary.pending, 600_000);
}

#[test]
fn test_claim_scheduled_nothing_claimable_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    client.configure(&creator, &500, &token);
    client.schedule_payout(&creator, &999_999, &100_000); // future only

    let result = client.try_claim_scheduled(&creator);
    assert_eq!(result, Err(Ok(Error::NothingToClaim)));
}

// ── error paths ───────────────────────────────────────────────────────────────

#[test]
fn test_record_accrual_requires_config() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, _token) = setup(&env);

    let result = client.try_record_accrual(&creator, &100);
    assert_eq!(result, Err(Ok(Error::ConfigNotFound)));
}

#[test]
fn test_configure_rejects_invalid_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, creator, token) = setup(&env);

    let result = client.try_configure(&creator, &10_001, &token);
    assert_eq!(result, Err(Ok(Error::InvalidRateBps)));
}

#[test]
fn test_double_init_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _creator, _token) = setup(&env);

    let result = client.try_init(&admin);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}
