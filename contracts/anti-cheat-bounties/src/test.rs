use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

fn setup(env: &Env) -> (AntiCheatBountiesClient<'_>, Address, Address, Address) {
    let admin = Address::generate(env);
    let token = Address::generate(env);
    let poster = Address::generate(env);
    let contract_id = env.register_contract(None, AntiCheatBounties);
    let client = AntiCheatBountiesClient::new(env, &contract_id);
    client.init(&admin, &token);
    (client, admin, token, poster)
}

fn game_id(env: &Env) -> Symbol {
    Symbol::new(env, "GAME1")
}

fn evidence(env: &Env) -> Symbol {
    Symbol::new(env, "EVID1")
}

// ── open_bounty_summary ───────────────────────────────────────────────────────

#[test]
fn test_open_bounty_summary_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, _poster) = setup(&env);

    let summary = client.open_bounty_summary();
    assert_eq!(summary.open_count, 0);
    assert_eq!(summary.under_review_count, 0);
    assert_eq!(summary.total_open_reward, 0);
}

#[test]
fn test_open_bounty_summary_with_open_bounties() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    // deadline > current_ledger (0), use 500
    client.post_bounty(&poster, &game_id(&env), &100_000, &2, &500);
    client.post_bounty(&poster, &game_id(&env), &200_000, &3, &500);

    let summary = client.open_bounty_summary();
    assert_eq!(summary.open_count, 2);
    assert_eq!(summary.total_open_reward, 300_000);
    assert_eq!(summary.under_review_count, 0);
}

#[test]
fn test_open_bounty_summary_excludes_under_review() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    let id = client.post_bounty(&poster, &game_id(&env), &100_000, &2, &500);
    client.begin_adjudication(&id);

    let summary = client.open_bounty_summary();
    assert_eq!(summary.open_count, 0);
    assert_eq!(summary.under_review_count, 1);
    assert_eq!(summary.total_open_reward, 0);
}

// ── adjudication_readiness ────────────────────────────────────────────────────

#[test]
fn test_adjudication_readiness_not_yet_ready() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    // deadline in future, no reports yet
    let id = client.post_bounty(&poster, &game_id(&env), &100_000, &2, &500);

    let readiness = client.adjudication_readiness(&id);
    assert!(readiness.exists);
    assert_eq!(readiness.report_count, 0);
    assert!(!readiness.has_enough_reports);
    assert!(!readiness.deadline_passed);
    assert!(!readiness.ready_to_adjudicate);
    assert_eq!(readiness.status, BountyStatus::Open);
}

#[test]
fn test_adjudication_readiness_enough_reports_deadline_passed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    // deadline=1, current ledger=0 initially (open is valid), reports submitted
    // then we advance ledger by bumping env ledger
    let id = client.post_bounty(&poster, &game_id(&env), &100_000, &2, &1);

    let reporter1 = Address::generate(&env);
    let reporter2 = Address::generate(&env);
    client.submit_report(&reporter1, &id, &evidence(&env));
    client.submit_report(&reporter2, &id, &evidence(&env));

    // At ledger 0, deadline_passed = (0 > 1) = false, but has_enough_reports = true
    let readiness = client.adjudication_readiness(&id);
    assert!(readiness.has_enough_reports);
    assert_eq!(readiness.report_count, 2);
    // Deadline has NOT passed yet at ledger 0
    assert!(!readiness.deadline_passed);
    assert!(!readiness.ready_to_adjudicate);
}

#[test]
fn test_adjudication_readiness_unknown_bounty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, _poster) = setup(&env);

    let readiness = client.adjudication_readiness(&9999u64);
    assert!(!readiness.exists);
    assert!(!readiness.ready_to_adjudicate);
}

// ── submit_report ─────────────────────────────────────────────────────────────

#[test]
fn test_submit_report_increments_count() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    let id = client.post_bounty(&poster, &game_id(&env), &100_000, &3, &500);
    let reporter = Address::generate(&env);
    client.submit_report(&reporter, &id, &evidence(&env));

    let readiness = client.adjudication_readiness(&id);
    assert_eq!(readiness.report_count, 1);
}

#[test]
fn test_duplicate_report_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    let id = client.post_bounty(&poster, &game_id(&env), &100_000, &2, &500);
    let reporter = Address::generate(&env);
    client.submit_report(&reporter, &id, &evidence(&env));

    let result = client.try_submit_report(&reporter, &id, &evidence(&env));
    assert_eq!(result, Err(Ok(Error::AlreadyReported)));
}

// ── error paths ───────────────────────────────────────────────────────────────

#[test]
fn test_post_bounty_invalid_reward() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    let result = client.try_post_bounty(&poster, &game_id(&env), &0, &2, &500);
    assert_eq!(result, Err(Ok(Error::InvalidReward)));
}

#[test]
fn test_post_bounty_invalid_min_reporters() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    let result = client.try_post_bounty(&poster, &game_id(&env), &1000, &0, &500);
    assert_eq!(result, Err(Ok(Error::InvalidMinReporters)));
}

#[test]
fn test_post_bounty_deadline_in_past() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, poster) = setup(&env);

    // current_ledger=0, deadline=0 is not > 0
    let result = client.try_post_bounty(&poster, &game_id(&env), &1000, &2, &0);
    assert_eq!(result, Err(Ok(Error::InvalidDeadline)));
}

#[test]
fn test_double_init_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, token, _poster) = setup(&env);

    let result = client.try_init(&admin, &token);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}
