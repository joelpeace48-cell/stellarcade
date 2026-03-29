#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token, Address, BytesN, Env, Map, String, Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 3,
    Overflow = 4,
    InsufficientBalance = 5,
    InvalidProof = 6,
    ProofAlreadyProcessed = 7,
    TokenNotMapped = 8,
    ContractPaused = 9,
    InvalidQuorum = 10,
    InvalidSignature = 11,
    RequestNotFound = 12,
}

// ── Bridge request tracking types ─────────────────────────────────

/// Direction of a bridge request from the perspective of this (Stellar) chain.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BridgeDirection {
    /// Outbound: assets leave Stellar (lock or burn_wrapped).
    Outbound = 0,
    /// Inbound: assets arrive on Stellar (mint_wrapped or release).
    Inbound = 1,
}

/// Lifecycle status of a bridge request.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BridgeRequestStatus {
    /// Request initiated; awaiting validator confirmations on remote chain.
    Initiated = 0,
    /// Request successfully finalized (proof accepted, assets transferred).
    Finalized = 1,
    /// Request marked failed by admin (e.g. stuck or expired).
    Failed = 2,
}

/// Full observable state of a single bridge request.
///
/// For outbound requests the `proof` field is zeroed (not yet known on-chain).
/// For inbound requests `request_id` is 0 and direction is `Inbound`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeRequestSummary {
    /// Stable identifier assigned at request creation (outbound only).
    pub request_id: u64,
    pub direction: BridgeDirection,
    pub asset: Address,
    pub amount: i128,
    /// Destination chain symbol (outbound) or source chain symbol (inbound).
    pub recipient_chain: Symbol,
    /// Human-readable recipient address on the remote chain.
    pub recipient: String,
    pub status: BridgeRequestStatus,
    /// For inbound requests: the 32-byte proof that was verified.
    /// For outbound requests: zeroed sentinel (proof not yet known on-chain).
    pub proof: BytesN<32>,
    /// Ledger sequence number at which this record was written.
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Validators,
    Quorum,
    TokenMapping(Symbol),
    WrappedTokenMapping(Address),
    ProcessedProofs(BytesN<32>),
    Paused,
    /// Monotonically increasing counter; each outbound call increments it.
    RequestNonce,
    /// Per-outbound-request record, keyed by sequential ID.
    BridgeRequest(u64),
    /// Per-inbound-finalization record, keyed by proof hash.
    InboundByProof(BytesN<32>),
}

// ── Events ────────────────────────────────────────────────────────
#[contractevent]
pub struct BridgeInitialized {
    pub admin: Address,
    pub quorum: u32,
}

#[contractevent]
pub struct TokenLocked {
    #[topic]
    pub asset: Address,
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub recipient_chain: Symbol,
    pub recipient: String,
    /// Sequential request ID assigned to this lock operation.
    pub request_id: u64,
}

#[contractevent]
pub struct WrappedMinted {
    #[topic]
    pub asset_symbol: Symbol,
    #[topic]
    pub recipient: Address,
    pub amount: i128,
    pub proof: BytesN<32>,
}

#[contractevent]
pub struct WrappedBurned {
    #[topic]
    pub asset: Address,
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub recipient_chain: Symbol,
    pub recipient: String,
    /// Sequential request ID assigned to this burn operation.
    pub request_id: u64,
}

#[contractevent]
pub struct TokenReleased {
    #[topic]
    pub asset: Address,
    #[topic]
    pub recipient: Address,
    pub amount: i128,
    pub proof: BytesN<32>,
}

#[contract]
pub struct CrossChainBridge;

#[contractimpl]
impl CrossChainBridge {
    pub fn init(
        env: Env,
        admin: Address,
        validators: Vec<BytesN<32>>,
        quorum: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        if quorum == 0 || quorum > validators.len() {
            return Err(Error::InvalidQuorum);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Validators, &validators);
        env.storage().instance().set(&DataKey::Quorum, &quorum);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::RequestNonce, &0u64);

        BridgeInitialized { admin, quorum }.publish(&env);
        Ok(())
    }

    pub fn set_token_mapping(env: Env, symbol: Symbol, asset: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::TokenMapping(symbol.clone()), &asset);
        env.storage().instance().set(&DataKey::WrappedTokenMapping(asset), &symbol);
        Ok(())
    }

    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    pub fn lock(
        env: Env,
        from: Address,
        asset: Address,
        amount: i128,
        recipient_chain: Symbol,
        recipient: String,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();

        let client = token::Client::new(&env, &asset);
        client.transfer(&from, &env.current_contract_address(), &amount);

        let request_id = next_request_id(&env);
        let record = BridgeRequestSummary {
            request_id,
            direction: BridgeDirection::Outbound,
            asset: asset.clone(),
            amount,
            recipient_chain: recipient_chain.clone(),
            recipient: recipient.clone(),
            status: BridgeRequestStatus::Initiated,
            proof: BytesN::from_array(&env, &[0u8; 32]),
            ledger: env.ledger().sequence(),
        };
        store_request(&env, request_id, &record);

        TokenLocked {
            asset,
            from,
            amount,
            recipient_chain,
            recipient,
            request_id,
        }
        .publish(&env);
        Ok(())
    }

    pub fn mint_wrapped(
        env: Env,
        asset_symbol: Symbol,
        amount: i128,
        recipient: Address,
        proof: BytesN<32>,
        signatures: Map<BytesN<32>, BytesN<64>>,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;
        verify_quorum(&env, &proof, &signatures)?;
        mark_processed(&env, &proof)?;

        let asset_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenMapping(asset_symbol.clone()))
            .ok_or(Error::TokenNotMapped)?;

        token::StellarAssetClient::new(&env, &asset_address).mint(&recipient, &amount);

        let record = BridgeRequestSummary {
            request_id: 0,
            direction: BridgeDirection::Inbound,
            asset: asset_address.clone(),
            amount,
            recipient_chain: asset_symbol.clone(),
            recipient: String::from_str(&env, ""),
            status: BridgeRequestStatus::Finalized,
            proof: proof.clone(),
            ledger: env.ledger().sequence(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::InboundByProof(proof.clone()), &record);

        WrappedMinted {
            asset_symbol,
            recipient,
            amount,
            proof,
        }
        .publish(&env);
        Ok(())
    }

    pub fn burn_wrapped(
        env: Env,
        from: Address,
        asset: Address,
        amount: i128,
        recipient_chain: Symbol,
        recipient: String,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();

        let _asset_symbol: Symbol = env
            .storage()
            .instance()
            .get(&DataKey::WrappedTokenMapping(asset.clone()))
            .ok_or(Error::TokenNotMapped)?;

        token::StellarAssetClient::new(&env, &asset).burn(&from, &amount);

        let request_id = next_request_id(&env);
        let record = BridgeRequestSummary {
            request_id,
            direction: BridgeDirection::Outbound,
            asset: asset.clone(),
            amount,
            recipient_chain: recipient_chain.clone(),
            recipient: recipient.clone(),
            status: BridgeRequestStatus::Initiated,
            proof: BytesN::from_array(&env, &[0u8; 32]),
            ledger: env.ledger().sequence(),
        };
        store_request(&env, request_id, &record);

        WrappedBurned {
            asset,
            from,
            amount,
            recipient_chain,
            recipient,
            request_id,
        }
        .publish(&env);
        Ok(())
    }

    pub fn release(
        env: Env,
        asset: Address,
        amount: i128,
        recipient: Address,
        proof: BytesN<32>,
        signatures: Map<BytesN<32>, BytesN<64>>,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;
        verify_quorum(&env, &proof, &signatures)?;
        mark_processed(&env, &proof)?;

        let client = token::Client::new(&env, &asset);
        client.transfer(&env.current_contract_address(), &recipient, &amount);

        let record = BridgeRequestSummary {
            request_id: 0,
            direction: BridgeDirection::Inbound,
            asset: asset.clone(),
            amount,
            recipient_chain: Symbol::new(&env, "stellar"),
            recipient: String::from_str(&env, ""),
            status: BridgeRequestStatus::Finalized,
            proof: proof.clone(),
            ledger: env.ledger().sequence(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::InboundByProof(proof.clone()), &record);

        TokenReleased {
            asset,
            recipient,
            amount,
            proof,
        }
        .publish(&env);
        Ok(())
    }

    // ── Request status accessors ──────────────────────────────────

    /// Return the full status summary for an outbound request by its sequential ID.
    ///
    /// Returns `None` when the ID is unknown; callers should treat absence as
    /// "not found" rather than an error.  The summary never exposes validator
    /// keys or signature material.
    pub fn get_request(env: Env, request_id: u64) -> Option<BridgeRequestSummary> {
        env.storage()
            .persistent()
            .get(&DataKey::BridgeRequest(request_id))
    }

    /// Return the finalization summary for an inbound operation identified by
    /// its 32-byte proof hash.
    ///
    /// Returns `None` when the proof has not been processed yet.
    pub fn get_inbound_finalization(env: Env, proof: BytesN<32>) -> Option<BridgeRequestSummary> {
        env.storage()
            .persistent()
            .get(&DataKey::InboundByProof(proof))
    }

    /// Admin-only: mark an outbound request as `Failed`.
    ///
    /// Intended for stuck or expired requests that will never be finalized.
    /// Returns `RequestNotFound` if `request_id` does not exist.
    pub fn mark_request_failed(env: Env, request_id: u64) -> Result<(), Error> {
        require_admin(&env)?;
        let key = DataKey::BridgeRequest(request_id);
        let mut record: BridgeRequestSummary = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::RequestNotFound)?;
        record.status = BridgeRequestStatus::Failed;
        env.storage().persistent().set(&key, &record);
        Ok(())
    }
}

// --- Internal Helpers ---

fn ensure_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
    if paused {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

fn require_admin(env: &Env) -> Result<(), Error> {
    let admin: Address =
        env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotAuthorized)?;
    admin.require_auth();
    Ok(())
}

fn verify_quorum(
    env: &Env,
    proof: &BytesN<32>,
    signatures: &Map<BytesN<32>, BytesN<64>>,
) -> Result<(), Error> {
    let validators: Vec<BytesN<32>> =
        env.storage().instance().get(&DataKey::Validators).ok_or(Error::NotAuthorized)?;
    let quorum: u32 =
        env.storage().instance().get(&DataKey::Quorum).ok_or(Error::NotAuthorized)?;

    if signatures.len() < quorum {
        return Err(Error::InvalidQuorum);
    }

    let mut valid_sigs = 0;
    for (pubkey, sig) in signatures.iter() {
        if !validators.contains(&pubkey) {
            continue;
        }

        // Real Ed25519 signature verification.
        // Host panics on failure with Crypto error.
        env.crypto().ed25519_verify(&pubkey, proof.as_ref(), &sig);

        valid_sigs += 1;
    }

    if valid_sigs < quorum {
        return Err(Error::InvalidQuorum);
    }

    Ok(())
}

fn mark_processed(env: &Env, proof: &BytesN<32>) -> Result<(), Error> {
    if env.storage().persistent().has(&DataKey::ProcessedProofs(proof.clone())) {
        return Err(Error::ProofAlreadyProcessed);
    }
    env.storage().persistent().set(&DataKey::ProcessedProofs(proof.clone()), &true);
    Ok(())
}

/// Atomically read-and-increment the outbound request nonce.
fn next_request_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::RequestNonce)
        .unwrap_or(0u64);
    let next = id.checked_add(1).expect("nonce overflow");
    env.storage().instance().set(&DataKey::RequestNonce, &next);
    id
}

/// Persist an outbound request record with a 30-day TTL bump.
fn store_request(env: &Env, request_id: u64, record: &BridgeRequestSummary) {
    const BUMP: u32 = 518_400;
    let key = DataKey::BridgeRequest(request_id);
    env.storage().persistent().set(&key, record);
    env.storage().persistent().extend_ttl(&key, BUMP, BUMP);
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        symbol_short,
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, BytesN, Env,
    };
    use ed25519_dalek::{SigningKey, Signer, VerifyingKey};
    use rand::rngs::OsRng;

    fn setup(env: &Env) -> (CrossChainBridgeClient<'_>, Address, Address, BytesN<32>, SigningKey) {
        let admin = Address::generate(env);

        let mut csprng = OsRng;
        let signing_key: SigningKey = SigningKey::generate(&mut csprng);
        let verifying_key: VerifyingKey = VerifyingKey::from(&signing_key);
        let validator_pk = BytesN::from_array(env, verifying_key.as_bytes());

        let contract_id = env.register(CrossChainBridge, ());
        let client = CrossChainBridgeClient::new(env, &contract_id);

        client.init(&admin, &Vec::from_array(env, [validator_pk.clone()]), &1);

        (client, admin, contract_id, validator_pk, signing_key)
    }

    // ── Existing behaviour ────────────────────────────────────────

    #[test]
    fn test_lock_and_release_with_real_sig() {
        let env = Env::default();
        let (client, _admin, bridge_addr, validator_pk, signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
        let token_client = TokenClient::new(&env, &token_addr);
        let token_sac = StellarAssetClient::new(&env, &token_addr);

        token_sac.mint(&user, &1000);

        client.lock(
            &user,
            &token_addr,
            &600,
            &symbol_short!("SOL"),
            &String::from_str(&env, "0xabc"),
        );
        assert_eq!(token_client.balance(&user), 400);
        assert_eq!(token_client.balance(&bridge_addr), 600);

        let proof_bytes = [7u8; 32];
        let proof = BytesN::from_array(&env, &proof_bytes);
        let signature_bytes = signing_key.sign(&proof_bytes).to_bytes();
        let sig = BytesN::from_array(&env, &signature_bytes);

        let mut sigs = Map::new(&env);
        sigs.set(validator_pk, sig);

        client.release(&token_addr, &300, &user, &proof, &sigs);
        assert_eq!(token_client.balance(&user), 700);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Crypto, InvalidInput)")]
    fn test_release_with_invalid_sig() {
        let env = Env::default();
        let (client, _admin, _, validator_pk, _) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_addr =
            env.register_stellar_asset_contract_v2(Address::generate(&env)).address();

        let proof = BytesN::from_array(&env, &[1u8; 32]);
        let bad_sig = BytesN::from_array(&env, &[0u8; 64]);
        let mut sigs = Map::new(&env);
        sigs.set(validator_pk, bad_sig);

        client.release(&token_addr, &100, &user, &proof, &sigs);
    }

    #[test]
    fn test_mint_wrapped_with_real_sig() {
        let env = Env::default();
        let (client, _, bridge_addr, validator_pk, signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(bridge_addr.clone()).address();
        let token_client = TokenClient::new(&env, &token_addr);

        let eth_symbol = symbol_short!("ETH");
        client.set_token_mapping(&eth_symbol, &token_addr);

        let proof_bytes = [11u8; 32];
        let proof = BytesN::from_array(&env, &proof_bytes);
        let signature_bytes = signing_key.sign(&proof_bytes).to_bytes();
        let sig = BytesN::from_array(&env, &signature_bytes);

        let mut sigs = Map::new(&env);
        sigs.set(validator_pk, sig);

        client.mint_wrapped(&eth_symbol, &1000, &user, &proof, &sigs);
        assert_eq!(token_client.balance(&user), 1000);
    }

    // ── Request status accessor tests ─────────────────────────────

    #[test]
    fn test_get_request_initiated_after_lock() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
        StellarAssetClient::new(&env, &token_addr).mint(&user, &1000);

        client.lock(
            &user,
            &token_addr,
            &400,
            &symbol_short!("ETH"),
            &String::from_str(&env, "0xdeadbeef"),
        );

        let summary = client.get_request(&0u64);
        assert!(summary.is_some());
        let s = summary.unwrap();
        assert_eq!(s.request_id, 0u64);
        assert_eq!(s.status, BridgeRequestStatus::Initiated);
        assert_eq!(s.direction, BridgeDirection::Outbound);
        assert_eq!(s.amount, 400);
    }

    #[test]
    fn test_get_request_missing_returns_none() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);

        // No lock has been called; request 99 should not exist.
        let result = client.get_request(&99u64);
        assert!(result.is_none());
    }

    #[test]
    fn test_get_inbound_finalization_after_release() {
        let env = Env::default();
        let (client, _admin, bridge_addr, validator_pk, signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
        StellarAssetClient::new(&env, &token_addr).mint(&bridge_addr, &500);

        let proof_bytes = [55u8; 32];
        let proof = BytesN::from_array(&env, &proof_bytes);
        let sig_bytes = signing_key.sign(&proof_bytes).to_bytes();
        let sig = BytesN::from_array(&env, &sig_bytes);
        let mut sigs = Map::new(&env);
        sigs.set(validator_pk, sig);

        client.release(&token_addr, &200, &user, &proof, &sigs);

        let summary = client.get_inbound_finalization(&proof);
        assert!(summary.is_some());
        let s = summary.unwrap();
        assert_eq!(s.status, BridgeRequestStatus::Finalized);
        assert_eq!(s.direction, BridgeDirection::Inbound);
        assert_eq!(s.amount, 200);
        assert_eq!(s.proof, proof);
    }

    #[test]
    fn test_get_inbound_finalization_missing_returns_none() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);

        let unknown_proof = BytesN::from_array(&env, &[0xffu8; 32]);
        let result = client.get_inbound_finalization(&unknown_proof);
        assert!(result.is_none());
    }

    #[test]
    fn test_mark_request_failed() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
        StellarAssetClient::new(&env, &token_addr).mint(&user, &1000);

        client.lock(
            &user,
            &token_addr,
            &100,
            &symbol_short!("BTC"),
            &String::from_str(&env, "bc1q..."),
        );

        // Initially Initiated.
        let before = client.get_request(&0u64).unwrap();
        assert_eq!(before.status, BridgeRequestStatus::Initiated);

        // Admin marks it failed.
        client.mark_request_failed(&0u64);

        let after = client.get_request(&0u64).unwrap();
        assert_eq!(after.status, BridgeRequestStatus::Failed);
    }

    #[test]
    fn test_mark_request_failed_unknown_returns_error() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);
        env.mock_all_auths();

        let result = client.try_mark_request_failed(&99u64);
        assert!(result.is_err());
    }

    #[test]
    fn test_sequential_request_ids() {
        let env = Env::default();
        let (client, _admin, _bridge_addr, _validator_pk, _signing_key) = setup(&env);
        env.mock_all_auths();

        let user = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
        StellarAssetClient::new(&env, &token_addr).mint(&user, &3000);

        client.lock(
            &user,
            &token_addr,
            &100,
            &symbol_short!("SOL"),
            &String::from_str(&env, "a"),
        );
        client.lock(
            &user,
            &token_addr,
            &200,
            &symbol_short!("SOL"),
            &String::from_str(&env, "b"),
        );
        client.lock(
            &user,
            &token_addr,
            &300,
            &symbol_short!("SOL"),
            &String::from_str(&env, "c"),
        );

        assert_eq!(client.get_request(&0u64).unwrap().amount, 100);
        assert_eq!(client.get_request(&1u64).unwrap().amount, 200);
        assert_eq!(client.get_request(&2u64).unwrap().amount, 300);
    }
}
