use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

fn setup(env: &Env) -> (TicketMarketClient<'_>, Address, Address, Address) {
    let admin = Address::generate(env);
    let token = Address::generate(env);
    let seller = Address::generate(env);
    let contract_id = env.register_contract(None, TicketMarket);
    let client = TicketMarketClient::new(env, &contract_id);
    client.init(&admin, &token);
    (client, admin, token, seller)
}

fn game_id(env: &Env) -> Symbol {
    Symbol::new(env, "FLIP")
}

// ── orderbook_summary ─────────────────────────────────────────────────────────

#[test]
fn test_orderbook_summary_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, _seller) = setup(&env);

    let summary = client.orderbook_summary();
    assert_eq!(summary.active_count, 0);
    assert_eq!(summary.best_ask, 0);
    assert_eq!(summary.worst_ask, 0);
    assert_eq!(summary.total_volume, 0);
}

#[test]
fn test_orderbook_summary_with_listings() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    // expires_at_ledger must be > current_ledger (0), so use 100
    client.list_ticket(&seller, &game_id(&env), &1_000, &100);
    client.list_ticket(&seller, &game_id(&env), &3_000, &100);
    client.list_ticket(&seller, &game_id(&env), &2_000, &100);

    let summary = client.orderbook_summary();
    assert_eq!(summary.active_count, 3);
    assert_eq!(summary.best_ask, 1_000);
    assert_eq!(summary.worst_ask, 3_000);
    assert_eq!(summary.total_volume, 6_000);
}

#[test]
fn test_orderbook_summary_excludes_cancelled() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    let id = client.list_ticket(&seller, &game_id(&env), &1_000, &100);
    client.cancel_listing(&seller, &id);

    let summary = client.orderbook_summary();
    assert_eq!(summary.active_count, 0);
    assert_eq!(summary.best_ask, 0);
}

// ── listing_expiry ────────────────────────────────────────────────────────────

#[test]
fn test_listing_expiry_active_listing() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    let id = client.list_ticket(&seller, &game_id(&env), &500, &999);

    let expiry = client.listing_expiry(&id);
    assert!(expiry.exists);
    assert_eq!(expiry.expires_at_ledger, 999);
    assert!(!expiry.is_expired);
    assert_eq!(expiry.status, ListingStatus::Active);
}

#[test]
fn test_listing_expiry_unknown_listing() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, _seller) = setup(&env);

    let expiry = client.listing_expiry(&9999u64);
    assert!(!expiry.exists);
    assert_eq!(expiry.expires_at_ledger, 0);
}

#[test]
fn test_listing_expiry_sold_listing() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    let id = client.list_ticket(&seller, &game_id(&env), &500, &999);
    client.fill_listing(&id);

    let expiry = client.listing_expiry(&id);
    assert!(expiry.exists);
    assert_eq!(expiry.status, ListingStatus::Sold);
}

// ── error paths ───────────────────────────────────────────────────────────────

#[test]
fn test_list_ticket_invalid_price() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    let result = client.try_list_ticket(&seller, &game_id(&env), &0, &100);
    assert_eq!(result, Err(Ok(Error::InvalidPrice)));
}

#[test]
fn test_list_ticket_expiry_in_past() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    // current ledger is 0, expires_at_ledger=0 is not > current
    let result = client.try_list_ticket(&seller, &game_id(&env), &100, &0);
    assert_eq!(result, Err(Ok(Error::InvalidExpiry)));
}

#[test]
fn test_cancel_others_listing_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);
    let other = Address::generate(&env);

    let id = client.list_ticket(&seller, &game_id(&env), &500, &100);
    let result = client.try_cancel_listing(&other, &id);
    assert_eq!(result, Err(Ok(Error::CannotCancelOthersListing)));
}

#[test]
fn test_double_cancel_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _token, seller) = setup(&env);

    let id = client.list_ticket(&seller, &game_id(&env), &500, &100);
    client.cancel_listing(&seller, &id);
    let result = client.try_cancel_listing(&seller, &id);
    assert_eq!(result, Err(Ok(Error::ListingNotActive)));
}

#[test]
fn test_double_init_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, token, _seller) = setup(&env);

    let result = client.try_init(&admin, &token);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}
