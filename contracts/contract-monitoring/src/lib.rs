#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, Env};

pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;
const DEFAULT_FAILED_SETTLEMENT_ALERT_THRESHOLD: u64 = 3;
const DEFAULT_ERROR_RATE_ALERT_PERCENT: u64 = 20;
const DEFAULT_ERROR_RATE_MIN_SAMPLE: u64 = 10;
pub const MAX_RECENT_EVENTS: u32 = 200;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    DuplicateEvent = 4,
    InvalidWindowSize = 5,
    InvalidThreshold = 6,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Metrics,
    Thresholds,
    SeenEvent(u64),
    RecentEvents,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventKind {
    SettlementSuccess = 0,
    SettlementFailed = 1,
    ContractError = 2,
    Paused = 3,
    Resumed = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimedEvent {
    pub timestamp: u64,
    pub kind: EventKind,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct Metrics {
    pub total_events: u64,
    pub settlement_success: u64,
    pub settlement_failed: u64,
    pub error_events: u64,
    pub paused_events: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HealthSnapshot {
    pub paused: bool,
    pub high_error_rate: bool,
    pub failed_settlement_alert: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AlertThresholds {
    pub failed_settlement_count: u64,
    pub error_rate_percent: u64,
    pub error_rate_min_sample: u64,
}

impl Default for AlertThresholds {
    fn default() -> Self {
        Self {
            failed_settlement_count: DEFAULT_FAILED_SETTLEMENT_ALERT_THRESHOLD,
            error_rate_percent: DEFAULT_ERROR_RATE_ALERT_PERCENT,
            error_rate_min_sample: DEFAULT_ERROR_RATE_MIN_SAMPLE,
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MonitoringSnapshot {
    pub initialized: bool,
    pub thresholds: AlertThresholds,
    pub metrics: Metrics,
    pub health: HealthSnapshot,
}

#[contractevent]
pub struct EventIngested {
    #[topic]
    pub event_id: u64,
    pub kind: EventKind,
}

#[contractevent]
pub struct AlertRaised {
    #[topic]
    pub alert: u32,
}

#[contract]
pub struct ContractMonitoring;

#[contractimpl]
impl ContractMonitoring {
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Metrics, &Metrics::default());
        env.storage().instance().set(&DataKey::Thresholds, &AlertThresholds::default());
        Ok(())
    }

    pub fn ingest_event(env: Env, admin: Address, event_id: u64, kind: EventKind) -> Result<Metrics, Error> {
        require_admin(&env, &admin)?;

        let seen_key = DataKey::SeenEvent(event_id);
        if env.storage().persistent().has(&seen_key) {
            return Err(Error::DuplicateEvent);
        }

        let mut metrics: Metrics = env.storage().instance().get(&DataKey::Metrics).unwrap_or_default();
        apply_event(&mut metrics, &kind);

        env.storage().instance().set(&DataKey::Metrics, &metrics);
        env.storage().persistent().set(&seen_key, &true);
        env.storage().persistent().extend_ttl(&seen_key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        // Record timed event for sliding window
        let now = env.ledger().timestamp();
        let mut recent_events: soroban_sdk::Vec<TimedEvent> = env.storage().instance().get(&DataKey::RecentEvents).unwrap_or_else(|| soroban_sdk::Vec::new(&env));
        recent_events.push_back(TimedEvent { timestamp: now, kind: kind.clone() });
        if recent_events.len() > MAX_RECENT_EVENTS {
            recent_events.pop_front();
        }
        env.storage().instance().set(&DataKey::RecentEvents, &recent_events);

        EventIngested { event_id, kind: kind.clone() }.publish(&env);

        let thresholds = get_thresholds(&env);
        let health = evaluate_health(&metrics, is_paused(&env), &thresholds);
        if health.failed_settlement_alert {
            AlertRaised { alert: 1 }.publish(&env);
        }
        if health.high_error_rate {
            AlertRaised { alert: 2 }.publish(&env);
        }
        if health.paused {
            AlertRaised { alert: 3 }.publish(&env);
        }

        Ok(metrics)
    }

    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    pub fn set_alert_thresholds(
        env: Env,
        admin: Address,
        thresholds: AlertThresholds,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        validate_thresholds(&thresholds)?;
        env.storage().instance().set(&DataKey::Thresholds, &thresholds);
        Ok(())
    }

    pub fn get_alert_thresholds(env: Env) -> AlertThresholds {
        get_thresholds(&env)
    }

    pub fn get_metrics(env: Env) -> Metrics {
        env.storage().instance().get(&DataKey::Metrics).unwrap_or_default()
    }

    pub fn get_health(env: Env) -> HealthSnapshot {
        let thresholds = get_thresholds(&env);
        evaluate_health(&Self::get_metrics(env.clone()), is_paused(&env), &thresholds)
    }

    pub fn get_snapshot(env: Env) -> MonitoringSnapshot {
        let thresholds = get_thresholds(&env);
        let metrics = Self::get_metrics(env.clone());
        let paused = is_paused(&env);
        let health = evaluate_health(&metrics, paused, &thresholds);

        MonitoringSnapshot {
            initialized: env.storage().instance().has(&DataKey::Admin),
            thresholds,
            metrics,
            health,
        }
    }

    pub fn get_sliding_window_metrics(env: Env, window_seconds: u64) -> Result<Metrics, Error> {
        if window_seconds == 0 {
            return Err(Error::InvalidWindowSize);
        }
        let now = env.ledger().timestamp();
        let start_time = now.saturating_sub(window_seconds);
        let recent_events: soroban_sdk::Vec<TimedEvent> = env.storage().instance().get(&DataKey::RecentEvents).unwrap_or_else(|| soroban_sdk::Vec::new(&env));

        let mut window_metrics = Metrics::default();
        for event in recent_events.iter() {
            if event.timestamp >= start_time {
                apply_event(&mut window_metrics, &event.kind);
            }
        }
        Ok(window_metrics)
    }
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), Error> {
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::NotInitialized);
    }
    admin.require_auth();
    let owner: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    if &owner != admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}

fn get_thresholds(env: &Env) -> AlertThresholds {
    env.storage()
        .instance()
        .get(&DataKey::Thresholds)
        .unwrap_or_default()
}

fn validate_thresholds(thresholds: &AlertThresholds) -> Result<(), Error> {
    if thresholds.failed_settlement_count == 0 {
        return Err(Error::InvalidThreshold);
    }
    if thresholds.error_rate_percent == 0 || thresholds.error_rate_percent > 100 {
        return Err(Error::InvalidThreshold);
    }
    if thresholds.error_rate_min_sample == 0 {
        return Err(Error::InvalidThreshold);
    }
    Ok(())
}

fn apply_event(metrics: &mut Metrics, kind: &EventKind) {
    metrics.total_events = metrics.total_events.saturating_add(1);
    match kind {
        EventKind::SettlementSuccess => metrics.settlement_success = metrics.settlement_success.saturating_add(1),
        EventKind::SettlementFailed => metrics.settlement_failed = metrics.settlement_failed.saturating_add(1),
        EventKind::ContractError => metrics.error_events = metrics.error_events.saturating_add(1),
        EventKind::Paused => metrics.paused_events = metrics.paused_events.saturating_add(1),
        EventKind::Resumed => {}
    }
}

fn evaluate_health(metrics: &Metrics, paused: bool, thresholds: &AlertThresholds) -> HealthSnapshot {
    let high_error_rate = is_high_error_rate(
        metrics.error_events,
        metrics.total_events,
        thresholds.error_rate_percent,
        thresholds.error_rate_min_sample,
    );
    let failed_settlement_alert = metrics.settlement_failed >= thresholds.failed_settlement_count;

    HealthSnapshot {
        paused,
        high_error_rate,
        failed_settlement_alert,
    }
}

fn is_high_error_rate(
    error_events: u64,
    total_events: u64,
    error_rate_percent: u64,
    error_rate_min_sample: u64,
) -> bool {
    if total_events < error_rate_min_sample || total_events == 0 {
        return false;
    }
    (error_events.saturating_mul(100) / total_events) >= error_rate_percent
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};

    #[test]
    fn marks_error_rate_when_threshold_crossed() {
        assert!(!is_high_error_rate(1, 5, 20, 10));
        assert!(!is_high_error_rate(1, 10, 20, 10));
        assert!(is_high_error_rate(2, 10, 20, 10));
        assert!(is_high_error_rate(3, 10, 20, 10));
    }

    #[test]
    fn applies_event_counts_deterministically() {
        let mut metrics = Metrics::default();
        apply_event(&mut metrics, &EventKind::SettlementSuccess);
        apply_event(&mut metrics, &EventKind::SettlementFailed);
        apply_event(&mut metrics, &EventKind::ContractError);

        assert_eq!(metrics.total_events, 3);
        assert_eq!(metrics.settlement_success, 1);
        assert_eq!(metrics.settlement_failed, 1);
        assert_eq!(metrics.error_events, 1);
    }

    #[test]
    fn test_sliding_window_metrics() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);

        client.init(&admin);

        // T=100
        env.ledger().set_timestamp(100);
        client.ingest_event(&admin, &1, &EventKind::SettlementSuccess);

        // T=200
        env.ledger().set_timestamp(200);
        client.ingest_event(&admin, &2, &EventKind::ContractError);

        // T=300
        env.ledger().set_timestamp(300);
        client.ingest_event(&admin, &3, &EventKind::SettlementSuccess);

        // Window 150s (T=150 to T=300). Events at 200, 300 included.
        let m = client.get_sliding_window_metrics(&150);
        assert_eq!(m.total_events, 2);
        assert_eq!(m.settlement_success, 1);
        assert_eq!(m.error_events, 1);

        // Window 50s (T=250 to T=300). Only event at 300 included.
        let m = client.get_sliding_window_metrics(&50);
        assert_eq!(m.total_events, 1);
        assert_eq!(m.settlement_success, 1);

        // Window 1000s. All 3 included.
        let m = client.get_sliding_window_metrics(&1000);
        assert_eq!(m.total_events, 3);
    }

    #[test]
    fn snapshot_is_available_before_init_with_defaults() {
        let env = Env::default();
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);

        let snap = client.get_snapshot();
        assert_eq!(snap.initialized, false);
        assert_eq!(snap.metrics, Metrics::default());
        assert_eq!(snap.thresholds, AlertThresholds::default());
        assert_eq!(snap.health.paused, false);
        assert_eq!(snap.health.high_error_rate, false);
        assert_eq!(snap.health.failed_settlement_alert, false);
    }

    #[test]
    fn thresholds_can_be_updated_by_admin_and_affect_snapshot() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);
        client.init(&admin);

        let new_thresholds = AlertThresholds {
            failed_settlement_count: 1,
            error_rate_percent: 10,
            error_rate_min_sample: 2,
        };
        client.set_alert_thresholds(&admin, &new_thresholds);
        assert_eq!(client.get_alert_thresholds(), new_thresholds);

        client.ingest_event(&admin, &1, &EventKind::SettlementFailed);
        let snap = client.get_snapshot();
        assert_eq!(snap.thresholds, new_thresholds);
        assert_eq!(snap.health.failed_settlement_alert, true);
    }

    #[test]
    fn threshold_updates_require_admin_auth() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let other = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);
        client.init(&admin);

        let thresholds = AlertThresholds {
            failed_settlement_count: 5,
            error_rate_percent: 25,
            error_rate_min_sample: 10,
        };
        let res = client.try_set_alert_thresholds(&other, &thresholds);
        assert!(res.is_err());
    }

    #[test]
    fn invalid_thresholds_are_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);
        client.init(&admin);

        let bad = AlertThresholds {
            failed_settlement_count: 0,
            error_rate_percent: 0,
            error_rate_min_sample: 0,
        };
        let res = client.try_set_alert_thresholds(&admin, &bad);
        assert!(res.is_err());
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_sliding_window_invalid_size() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin);

        client.get_sliding_window_metrics(&0);
    }

    #[test]
    fn test_sliding_window_cap() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(ContractMonitoring, ());
        let client = ContractMonitoringClient::new(&env, &contract_id);

        client.init(&admin);

        for i in 0..210 {
            client.ingest_event(&admin, &(i as u64), &EventKind::SettlementSuccess);
        }

        let m = client.get_sliding_window_metrics(&86400);
        // Should be capped at MAX_RECENT_EVENTS (200)
        assert_eq!(m.total_events, 200);
    }
}
