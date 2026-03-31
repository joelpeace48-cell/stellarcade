#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String,
};

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

/// Lifecycle visibility state for a session snapshot.
/// Missing = game_id not found; Active = in-flight; Completed = resolved.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum SnapshotStatus {
    /// No session exists for the requested game_id.
    Missing = 0,
    /// Session exists but has not yet been resolved (Created or InProgress).
    Active = 1,
    /// Session has been resolved by the oracle.
    Completed = 2,
}

/// Read model returned by `get_session_snapshot`.
///
/// Exposes enough state for a client to resume an in-progress session without
/// leaking sensitive prompt internals. The `prompt_hash` field is the
/// SHA-256 commitment stored at game creation — it is safe to expose for
/// verification purposes but does NOT reveal the underlying prompt content.
///
/// Fields intentionally omitted (redacted):
/// - Raw prompt / config payload (never stored on-chain; only the hash is kept)
/// - Oracle result payload (stored off-chain; not part of on-chain state)
/// - Internal reward-claim flags (private accounting detail)
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SessionSnapshot {
    /// Requested game identifier.
    pub game_id: u64,
    /// Lifecycle visibility state.
    pub status: SnapshotStatus,
    /// SHA-256 hash of the game configuration / prompt committed at creation.
    /// Zero-filled when status is Missing.
    pub prompt_hash: BytesN<32>,
    /// Address of the winner once the session is Completed; None otherwise.
    pub winner: Option<Address>,
    /// True when a winner has been designated (convenience flag for clients).
    pub has_winner: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    ModelOracle,
    RewardContract,
    // Maps a game ID to the game state
    Game(u64),
    // Maps (game_id, player_address) to boolean indicator of reward status
    Reward(u64, Address),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum GameStatus {
    Created,
    InProgress,
    Resolved,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AIGameState {
    pub config_hash: BytesN<32>,
    pub status: GameStatus,
    pub winner: Option<Address>,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    GameAlreadyExists = 4,
    GameNotFound = 5,
    InvalidStatus = 6,
    RewardAlreadyClaimed = 7,
    NoReward = 8,
}

// ── Events ────────────────────────────────────────────────────────
#[contractevent]
pub struct ContractInitialized {
    pub admin: Address,
    pub model_oracle: Address,
    pub reward_contract: Address,
}

#[contractevent]
pub struct GameCreated {
    #[topic]
    pub game_id: u64,
    pub config_hash: BytesN<32>,
}

#[contractevent]
pub struct MovePlayed {
    #[topic]
    pub game_id: u64,
    #[topic]
    pub player: Address,
    pub move_payload: String,
}

#[contractevent]
pub struct GameResolved {
    #[topic]
    pub game_id: u64,
    #[topic]
    pub oracle: Address,
    pub result_payload: String,
    pub winner: Option<Address>,
}

#[contractevent]
pub struct RewardClaimed {
    #[topic]
    pub game_id: u64,
    #[topic]
    pub player: Address,
}

#[contract]
pub struct AIGeneratedGameContract;

#[contractimpl]
impl AIGeneratedGameContract {
    /// Initialize the contract with the admin, AI model oracle address, and reward system address.
    pub fn init(
        env: Env,
        admin: Address,
        model_oracle: Address,
        reward_contract: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ModelOracle, &model_oracle);
        env.storage().instance().set(&DataKey::RewardContract, &reward_contract);

        ContractInitialized {
            admin: admin.clone(),
            model_oracle,
            reward_contract,
        }
        .publish(&env);
        Ok(())
    }

    /// Setup a new AI-generated game layout.
    pub fn create_ai_game(
        env: Env,
        admin: Address,
        game_id: u64,
        config_hash: BytesN<32>,
    ) -> Result<(), Error> {
        admin.require_auth();
        let stored_admin: Address =
            env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;

        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        let game_key = DataKey::Game(game_id);
        if env.storage().persistent().has(&game_key) {
            return Err(Error::GameAlreadyExists);
        }

        let state = AIGameState {
            config_hash: config_hash.clone(),
            status: GameStatus::Created,
            winner: None,
        };

        env.storage().persistent().set(&game_key, &state);
        GameCreated { game_id, config_hash }.publish(&env);
        Ok(())
    }

    /// Player submitting a move towards an active AI game.
    pub fn submit_ai_move(
        env: Env,
        player: Address,
        game_id: u64,
        move_payload: String,
    ) -> Result<(), Error> {
        player.require_auth();

        let game_key = DataKey::Game(game_id);
        let mut state: AIGameState =
            env.storage().persistent().get(&game_key).ok_or(Error::GameNotFound)?;

        if state.status == GameStatus::Created {
            state.status = GameStatus::InProgress;
            env.storage().persistent().set(&game_key, &state);
        } else if state.status != GameStatus::InProgress {
            return Err(Error::InvalidStatus);
        }

        MovePlayed {
            game_id,
            player,
            move_payload,
        }
        .publish(&env);
        Ok(())
    }

    /// Oracle node resolves the game securely mapping outputs and winners systematically.
    pub fn resolve_ai_game(
        env: Env,
        oracle: Address,
        game_id: u64,
        result_payload: String,
        winner: Option<Address>,
    ) -> Result<(), Error> {
        oracle.require_auth();
        let stored_oracle: Address = env
            .storage()
            .instance()
            .get(&DataKey::ModelOracle)
            .ok_or(Error::NotInitialized)?;

        if oracle != stored_oracle {
            return Err(Error::Unauthorized);
        }

        let game_key = DataKey::Game(game_id);
        let mut state: AIGameState =
            env.storage().persistent().get(&game_key).ok_or(Error::GameNotFound)?;

        if state.status == GameStatus::Resolved {
            return Err(Error::InvalidStatus);
        }

        state.status = GameStatus::Resolved;
        state.winner = winner.clone();

        env.storage().persistent().set(&game_key, &state);

        if let Some(w) = winner.clone() {
            env.storage().persistent().set(&DataKey::Reward(game_id, w.clone()), &true);
        }

        GameResolved {
            game_id,
            oracle: oracle.clone(),
            result_payload,
            winner,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns a stable read-only snapshot of a session for client resume flows.
    ///
    /// Safe to call without authentication — no sensitive internals are exposed.
    /// Returns a deterministic `Missing` snapshot when the game_id is unknown,
    /// so callers never need to handle a hard error for a simple lookup.
    pub fn get_session_snapshot(env: Env, game_id: u64) -> SessionSnapshot {
        let game_key = DataKey::Game(game_id);
        match env.storage().persistent().get::<DataKey, AIGameState>(&game_key) {
            None => SessionSnapshot {
                game_id,
                status: SnapshotStatus::Missing,
                prompt_hash: BytesN::from_array(&env, &[0u8; 32]),
                winner: None,
                has_winner: false,
            },
            Some(state) => {
                let status = match state.status {
                    GameStatus::Resolved => SnapshotStatus::Completed,
                    _ => SnapshotStatus::Active,
                };
                let has_winner = state.winner.is_some();
                SessionSnapshot {
                    game_id,
                    status,
                    prompt_hash: state.config_hash,
                    winner: state.winner,
                    has_winner,
                }
            }
        }
    }

    /// Authorizes player to claim rewards mapped after oracle validation finishes.
    pub fn claim_ai_reward(env: Env, player: Address, game_id: u64) -> Result<(), Error> {
        player.require_auth();

        let game_key = DataKey::Game(game_id);
        let state: AIGameState =
            env.storage().persistent().get(&game_key).ok_or(Error::GameNotFound)?;

        if state.status != GameStatus::Resolved {
            return Err(Error::InvalidStatus);
        }

        let reward_key = DataKey::Reward(game_id, player.clone());
        let can_claim_opt: Option<bool> = env.storage().persistent().get(&reward_key);

        if can_claim_opt.is_none() {
            return Err(Error::NoReward);
        }

        let can_claim = can_claim_opt.unwrap();
        if !can_claim {
            return Err(Error::RewardAlreadyClaimed);
        }

        env.storage().persistent().set(&reward_key, &false);

        // Ensure reward tracking was allocated correctly globally securely via event binding
        RewardClaimed {
            game_id,
            player: player.clone(),
        }
        .publish(&env);

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

    #[test]
    fn test_initialization() {
        let env = Env::default();
        let contract_id = env.register(AIGeneratedGameContract, ());
        let client = AIGeneratedGameContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let reward_system = Address::generate(&env);

        client.init(&admin, &oracle, &reward_system);

        let init_result = client.try_init(&admin, &oracle, &reward_system);
        assert_eq!(init_result, Err(Ok(Error::AlreadyInitialized)));
    }

    #[test]
    fn test_game_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AIGeneratedGameContract, ());
        let client = AIGeneratedGameContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let reward_system = Address::generate(&env);
        let player = Address::generate(&env);

        client.init(&admin, &oracle, &reward_system);

        let game_id: u64 = 1;
        let config_hash = BytesN::from_array(&env, &[0; 32]);

        client.create_ai_game(&admin, &game_id, &config_hash);

        // Assert dup creation rejection natively
        let dup_create = client.try_create_ai_game(&admin, &game_id, &config_hash);
        assert_eq!(dup_create, Err(Ok(Error::GameAlreadyExists)));

        let move_payload = String::from_str(&env, "player1_move");
        client.submit_ai_move(&player, &game_id, &move_payload);

        let result_payload = String::from_str(&env, "score: 100");
        client.resolve_ai_game(&oracle, &game_id, &result_payload, &Some(player.clone()));

        // Cannot claim rewards of someone else
        let player2 = Address::generate(&env);
        let reward_fail = client.try_claim_ai_reward(&player2, &game_id);
        assert_eq!(reward_fail, Err(Ok(Error::NoReward)));

        // Successful claim mapping logic transitions correctly
        client.claim_ai_reward(&player, &game_id);

        // Cannot reclaim
        let double_claim = client.try_claim_ai_reward(&player, &game_id);
        assert_eq!(double_claim, Err(Ok(Error::RewardAlreadyClaimed)));
    }

    #[test]
    fn test_session_snapshot_unknown() {
        let env = Env::default();
        let contract_id = env.register(AIGeneratedGameContract, ());
        let client = AIGeneratedGameContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let reward_system = Address::generate(&env);
        client.init(&admin, &oracle, &reward_system);

        // Unknown game_id must return a deterministic Missing snapshot
        let snap = client.get_session_snapshot(&999u64);
        assert_eq!(snap.game_id, 999u64);
        assert_eq!(snap.status, SnapshotStatus::Missing);
        assert_eq!(snap.prompt_hash, BytesN::from_array(&env, &[0u8; 32]));
        assert_eq!(snap.winner, None);
        assert!(!snap.has_winner);
    }

    #[test]
    fn test_session_snapshot_active() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AIGeneratedGameContract, ());
        let client = AIGeneratedGameContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let reward_system = Address::generate(&env);
        let player = Address::generate(&env);

        client.init(&admin, &oracle, &reward_system);

        let game_id: u64 = 42;
        let config_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_ai_game(&admin, &game_id, &config_hash);

        // Before any move: Created → still Active
        let snap = client.get_session_snapshot(&game_id);
        assert_eq!(snap.game_id, game_id);
        assert_eq!(snap.status, SnapshotStatus::Active);
        assert_eq!(snap.prompt_hash, config_hash);
        assert_eq!(snap.winner, None);
        assert!(!snap.has_winner);

        // After a move: InProgress → still Active
        let move_payload = String::from_str(&env, "move_data");
        client.submit_ai_move(&player, &game_id, &move_payload);

        let snap2 = client.get_session_snapshot(&game_id);
        assert_eq!(snap2.status, SnapshotStatus::Active);
        assert_eq!(snap2.prompt_hash, config_hash);
    }

    #[test]
    fn test_session_snapshot_completed() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AIGeneratedGameContract, ());
        let client = AIGeneratedGameContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let reward_system = Address::generate(&env);
        let player = Address::generate(&env);

        client.init(&admin, &oracle, &reward_system);

        let game_id: u64 = 7;
        let config_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.create_ai_game(&admin, &game_id, &config_hash);

        let move_payload = String::from_str(&env, "final_move");
        client.submit_ai_move(&player, &game_id, &move_payload);

        let result_payload = String::from_str(&env, "result");
        client.resolve_ai_game(&oracle, &game_id, &result_payload, &Some(player.clone()));

        let snap = client.get_session_snapshot(&game_id);
        assert_eq!(snap.game_id, game_id);
        assert_eq!(snap.status, SnapshotStatus::Completed);
        assert_eq!(snap.prompt_hash, config_hash);
        assert_eq!(snap.winner, Some(player));
        assert!(snap.has_winner);
    }
}
