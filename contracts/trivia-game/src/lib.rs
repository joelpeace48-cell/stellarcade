//! Stellarcade Daily Trivia Game Contract
//!
//! Supports lightweight round configuration so clients can inspect the
//! currently active round and its question-set metadata.
#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    RoundAlreadyExists = 4,
    RoundNotFound = 5,
    InvalidConfig = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    ActiveRoundId,
    Round(u64),
    Participation(u64, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RoundStatus {
    Configured = 0,
    Active = 1,
    Closed = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoundData {
    pub question_set_id: u64,
    pub question_count: u32,
    pub category: String,
    pub difficulty: u32,
    pub starts_at: u64,
    pub ends_at: u64,
    pub participant_count: u32,
    pub submission_count: u32,
    pub status: RoundStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QuestionSetMetadata {
    pub round_id: u64,
    pub question_set_id: u64,
    pub question_count: u32,
    pub category: String,
    pub difficulty: u32,
    pub starts_at: u64,
    pub ends_at: u64,
    pub status: RoundStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActiveRoundSnapshot {
    pub has_active_round: bool,
    pub round_id: u64,
    pub question_set_id: u64,
    pub starts_at: u64,
    pub ends_at: u64,
    pub now: u64,
    pub participant_count: u32,
    pub submission_count: u32,
    pub is_accepting_answers: bool,
}

#[contract]
pub struct TriviaGame;

#[contractimpl]
impl TriviaGame {
    /// Initialize the contract once with an admin who can configure rounds.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Configure a round and its question-set metadata.
    pub fn configure_round(
        env: Env,
        admin: Address,
        round_id: u64,
        question_set_id: u64,
        question_count: u32,
        category: String,
        difficulty: u32,
        starts_at: u64,
        ends_at: u64,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        if round_id == 0 || question_set_id == 0 || question_count == 0 || ends_at <= starts_at {
            return Err(Error::InvalidConfig);
        }

        let key = DataKey::Round(round_id);
        if env.storage().persistent().has(&key) {
            return Err(Error::RoundAlreadyExists);
        }

        env.storage().persistent().set(
            &key,
            &RoundData {
                question_set_id,
                question_count,
                category,
                difficulty,
                starts_at,
                ends_at,
                participant_count: 0,
                submission_count: 0,
                status: RoundStatus::Configured,
            },
        );
        Ok(())
    }

    /// Mark a configured round as active.
    pub fn activate_round(env: Env, admin: Address, round_id: u64) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        let key = DataKey::Round(round_id);
        let mut round: RoundData = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::RoundNotFound)?;

        if let Some(previous_round_id) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::ActiveRoundId)
        {
            if previous_round_id != round_id {
                let previous_key = DataKey::Round(previous_round_id);
                if let Some(mut previous_round) = env
                    .storage()
                    .persistent()
                    .get::<DataKey, RoundData>(&previous_key)
                {
                    if previous_round.status == RoundStatus::Active {
                        previous_round.status = RoundStatus::Configured;
                        env.storage()
                            .persistent()
                            .set(&previous_key, &previous_round);
                    }
                }
            }
        }

        round.status = RoundStatus::Active;
        env.storage().persistent().set(&key, &round);
        env.storage()
            .instance()
            .set(&DataKey::ActiveRoundId, &round_id);
        Ok(())
    }

    /// Submit an answer for the current active round.
    ///
    /// The method records participation metadata only; answer validation
    /// remains out of scope for this contract stub.
    pub fn submit_answer(env: Env, player: Address, question_id: u32, answer: String) {
        let _ = (question_id, answer);
        player.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return;
        }

        let Some(round_id) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::ActiveRoundId)
        else {
            return;
        };

        let round_key = DataKey::Round(round_id);
        let Some(mut round) = env
            .storage()
            .persistent()
            .get::<DataKey, RoundData>(&round_key)
        else {
            return;
        };

        let now = env.ledger().timestamp();
        if round.status != RoundStatus::Active || now < round.starts_at || now > round.ends_at {
            return;
        }

        round.submission_count = round.submission_count.saturating_add(1);

        let participation_key = DataKey::Participation(round_id, player);
        if !env.storage().persistent().has(&participation_key) {
            env.storage().persistent().set(&participation_key, &true);
            round.participant_count = round.participant_count.saturating_add(1);
        }

        env.storage().persistent().set(&round_key, &round);
    }

    /// Claim rewards for a correct answer.
    pub fn claim_reward(_env: Env, player: Address, _game_id: u32) {
        player.require_auth();
        // TODO: Verify winner status
        // TODO: Call PrizePool for payout
    }

    /// Return the display-safe question-set metadata for a configured round.
    pub fn question_set_metadata(env: Env, round_id: u64) -> Result<QuestionSetMetadata, Error> {
        require_initialized(&env)?;

        let round: RoundData = env
            .storage()
            .persistent()
            .get(&DataKey::Round(round_id))
            .ok_or(Error::RoundNotFound)?;

        Ok(QuestionSetMetadata {
            round_id,
            question_set_id: round.question_set_id,
            question_count: round.question_count,
            category: round.category,
            difficulty: round.difficulty,
            starts_at: round.starts_at,
            ends_at: round.ends_at,
            status: round.status,
        })
    }

    /// Return a deterministic snapshot of the active round, if one exists.
    ///
    /// When no round is active the snapshot is zeroed with
    /// `has_active_round = false`.
    pub fn active_round_snapshot(env: Env) -> ActiveRoundSnapshot {
        let now = env.ledger().timestamp();

        if !env.storage().instance().has(&DataKey::Admin) {
            return empty_snapshot(now);
        }

        let Some(round_id) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::ActiveRoundId)
        else {
            return empty_snapshot(now);
        };

        let Some(round) = env
            .storage()
            .persistent()
            .get::<DataKey, RoundData>(&DataKey::Round(round_id))
        else {
            return empty_snapshot(now);
        };

        if round.status != RoundStatus::Active {
            return empty_snapshot(now);
        }

        ActiveRoundSnapshot {
            has_active_round: true,
            round_id,
            question_set_id: round.question_set_id,
            starts_at: round.starts_at,
            ends_at: round.ends_at,
            now,
            participant_count: round.participant_count,
            submission_count: round.submission_count,
            is_accepting_answers: now >= round.starts_at && now <= round.ends_at,
        }
    }
}

fn require_initialized(env: &Env) -> Result<(), Error> {
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::NotInitialized);
    }

    Ok(())
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), Error> {
    require_initialized(env)?;

    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    admin.require_auth();

    if admin != &stored_admin {
        return Err(Error::NotAuthorized);
    }

    Ok(())
}

fn empty_snapshot(now: u64) -> ActiveRoundSnapshot {
    ActiveRoundSnapshot {
        has_active_round: false,
        round_id: 0,
        question_set_id: 0,
        starts_at: 0,
        ends_at: 0,
        now,
        participant_count: 0,
        submission_count: 0,
        is_accepting_answers: false,
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    fn setup(env: &Env) -> (TriviaGameClient<'_>, Address) {
        let admin = Address::generate(env);
        let contract_id = env.register(TriviaGame, ());
        let client = TriviaGameClient::new(env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        (client, admin)
    }

    fn set_time(env: &Env, timestamp: u64) {
        env.ledger().with_mut(|li| {
            li.timestamp = timestamp;
        });
    }

    #[test]
    fn test_active_round_snapshot_inactive_state() {
        let env = Env::default();
        let (client, _) = setup(&env);

        set_time(&env, 1_000);
        let snapshot = client.active_round_snapshot();
        assert!(!snapshot.has_active_round);
        assert_eq!(snapshot.round_id, 0);
        assert_eq!(snapshot.question_set_id, 0);
        assert_eq!(snapshot.participant_count, 0);
        assert_eq!(snapshot.submission_count, 0);
        assert!(!snapshot.is_accepting_answers);
    }

    #[test]
    fn test_question_set_metadata_for_configured_round() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        env.mock_all_auths();

        let category = String::from_str(&env, "general");
        client.configure_round(
            &admin, &7u64, &42u64, &12u32, &category, &3u32, &1_000u64, &2_000u64,
        );

        let metadata = client.question_set_metadata(&7u64);
        assert_eq!(metadata.round_id, 7);
        assert_eq!(metadata.question_set_id, 42);
        assert_eq!(metadata.question_count, 12);
        assert_eq!(metadata.category, category);
        assert_eq!(metadata.difficulty, 3);
        assert_eq!(metadata.starts_at, 1_000);
        assert_eq!(metadata.ends_at, 2_000);
        assert_eq!(metadata.status, RoundStatus::Configured);
    }

    #[test]
    fn test_active_round_snapshot_tracks_timing_and_participation() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        env.mock_all_auths();

        let category = String::from_str(&env, "arcade");
        client.configure_round(
            &admin, &9u64, &77u64, &8u32, &category, &2u32, &1_000u64, &2_000u64,
        );
        client.activate_round(&admin, &9u64);

        set_time(&env, 1_500);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);
        let answer = String::from_str(&env, "A");

        client.submit_answer(&player_a, &1u32, &answer);
        client.submit_answer(&player_a, &2u32, &answer);
        client.submit_answer(&player_b, &3u32, &answer);

        let snapshot = client.active_round_snapshot();
        assert!(snapshot.has_active_round);
        assert_eq!(snapshot.round_id, 9);
        assert_eq!(snapshot.question_set_id, 77);
        assert_eq!(snapshot.starts_at, 1_000);
        assert_eq!(snapshot.ends_at, 2_000);
        assert_eq!(snapshot.now, 1_500);
        assert_eq!(snapshot.participant_count, 2);
        assert_eq!(snapshot.submission_count, 3);
        assert!(snapshot.is_accepting_answers);

        let repeated_read = client.active_round_snapshot();
        assert_eq!(snapshot, repeated_read);
    }
}
