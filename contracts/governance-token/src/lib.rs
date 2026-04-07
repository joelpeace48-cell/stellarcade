#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    Address, Env, String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    InsufficientBalance = 3,
    InvalidAmount = 4,
    Overflow = 5,
}

/// Maximum number of checkpoints retained per holder.
const MAX_CHECKPOINTS: u32 = 50;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    Balance(Address),
    TotalSupply,
    /// Ordered list of checkpoints for a holder (oldest → newest).
    Checkpoints(Address),
}

/// A single voting-weight snapshot recorded at a given ledger sequence.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Checkpoint {
    pub ledger: u32,
    pub balance: i128,
}

// ── Events ────────────────────────────────────────────────────────
#[contractevent]
pub struct TokenInitialized {
    #[topic]
    pub admin: Address,
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contractevent]
pub struct TokenMinted {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TokenBurned {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TokenTransferred {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contract]
pub struct GovernanceToken;

// ── Internal helpers ──────────────────────────────────────────────
fn write_checkpoint(env: &Env, holder: &Address, new_balance: i128) {
    let key = DataKey::Checkpoints(holder.clone());
    let mut history: Vec<Checkpoint> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    let cp = Checkpoint {
        ledger: env.ledger().sequence(),
        balance: new_balance,
    };

    // Overwrite if the last entry is from the same ledger (idempotent within a tx).
    if let Some(last) = history.last() {
        if last.ledger == cp.ledger {
            let last_idx = history.len() - 1;
            history.set(last_idx, cp);
            env.storage().persistent().set(&key, &history);
            return;
        }
    }

    // Evict oldest entry when the cap is reached.
    if history.len() >= MAX_CHECKPOINTS {
        let mut trimmed: Vec<Checkpoint> = Vec::new(env);
        for i in 1..history.len() {
            trimmed.push_back(history.get(i).unwrap());
        }
        history = trimmed;
    }

    history.push_back(cp);
    env.storage().persistent().set(&key, &history);
}

#[contractimpl]
impl GovernanceToken {
    /// Initializes the contract with the admin address and token setup.
    /// Requires admin authorization to prevent arbitrary initialization.
    pub fn init(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        // Security Fix: Require admin auth during initialization
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        TokenInitialized {
            admin,
            name,
            symbol,
            decimals,
        }
        .publish(&env);
        Ok(())
    }

    /// Mints new tokens to a recipient. Only admin can call.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let admin: Address =
            env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotAuthorized)?;
        admin.require_auth();

        let balance = Self::balance(env.clone(), to.clone());
        let new_balance = balance.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &new_balance);
        write_checkpoint(&env, &to, new_balance);

        let total_supply = Self::total_supply(env.clone());
        let new_total_supply = total_supply.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalSupply, &new_total_supply);

        TokenMinted { to, amount }.publish(&env);
        Ok(())
    }

    /// Burns tokens from an account. Only admin can call.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let admin: Address =
            env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotAuthorized)?;
        admin.require_auth();

        let balance = Self::balance(env.clone(), from.clone());
        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let new_balance = balance.checked_sub(amount).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &new_balance);
        write_checkpoint(&env, &from, new_balance);

        let total_supply = Self::total_supply(env.clone());
        let new_total_supply = total_supply.checked_sub(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalSupply, &new_total_supply);

        TokenBurned { from, amount }.publish(&env);
        Ok(())
    }

    /// Transfers tokens between accounts. Requires sender authorization.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();

        let balance_from = Self::balance(env.clone(), from.clone());
        if balance_from < amount {
            return Err(Error::InsufficientBalance);
        }

        let new_balance_from = balance_from.checked_sub(amount).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &new_balance_from);
        write_checkpoint(&env, &from, new_balance_from);

        let balance_to = Self::balance(env.clone(), to.clone());
        let new_balance_to = balance_to.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &new_balance_to);
        write_checkpoint(&env, &to, new_balance_to);

        TokenTransferred { from, to, amount }.publish(&env);
        Ok(())
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(id)).unwrap_or(0i128)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0i128)
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    // ── Checkpoint accessors ──────────────────────────────────────

    /// Returns the most recent checkpoint for `holder`.
    /// Returns `None` when the holder has no recorded history.
    pub fn latest_checkpoint(env: Env, holder: Address) -> Option<Checkpoint> {
        let history: Vec<Checkpoint> = env
            .storage()
            .persistent()
            .get(&DataKey::Checkpoints(holder))
            .unwrap_or_else(|| Vec::new(&env));
        history.last()
    }

    /// Returns up to `limit` most-recent checkpoints for `holder`, ordered
    /// oldest-first within the returned slice.  `limit` is capped at
    /// `MAX_CHECKPOINTS`.  Returns an empty vec for unknown holders.
    pub fn checkpoint_history(env: Env, holder: Address, limit: u32) -> Vec<Checkpoint> {
        let history: Vec<Checkpoint> = env
            .storage()
            .persistent()
            .get(&DataKey::Checkpoints(holder))
            .unwrap_or_else(|| Vec::new(&env));

        let cap = limit.min(MAX_CHECKPOINTS) as usize;
        let len = history.len() as usize;
        if cap == 0 || len == 0 {
            return Vec::new(&env);
        }

        let start = if len > cap { len - cap } else { 0 };
        let mut result: Vec<Checkpoint> = Vec::new(&env);
        for i in start..len {
            result.push_back(history.get(i as u32).unwrap());
        }
        result
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
    use soroban_sdk::IntoVal;

    fn setup() -> (Env, Address, soroban_sdk::Address, GovernanceTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(GovernanceToken, ());
        let client = GovernanceTokenClient::new(&env, &contract_id);
        client.init(
            &admin,
            &String::from_str(&env, "StellarCade Governance"),
            &String::from_str(&env, "SCG"),
            &18,
        );
        (env, admin, contract_id, client)
    }

    #[test]
    fn test_token_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        let contract_id = env.register(GovernanceToken, ());
        let client = GovernanceTokenClient::new(&env, &contract_id);

        client.init(
            &admin,
            &String::from_str(&env, "StellarCade Governance"),
            &String::from_str(&env, "SCG"),
            &18,
        );

        client.mint(&user1, &1000);
        assert_eq!(client.balance(&user1), 1000);
        assert_eq!(client.total_supply(), 1000);

        client.transfer(&user1, &user2, &400);
        assert_eq!(client.balance(&user1), 600);
        assert_eq!(client.balance(&user2), 400);

        client.burn(&user2, &100);
        assert_eq!(client.balance(&user2), 300);
        assert_eq!(client.total_supply(), 900);
    }

    #[test]
    #[should_panic(expected = "Error(Auth, InvalidAction)")]
    fn test_unauthorized_mint() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let malicious = Address::generate(&env);
        let contract_id = env.register(GovernanceToken, ());
        let client = GovernanceTokenClient::new(&env, &contract_id);

        client.init(
            &admin,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "T"),
            &0,
        );

        // Use mock_auths to simulate authorization from malicious address
        client.mock_auths(&[MockAuth {
            address: &malicious,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "mint",
                args: (user.clone(), 1000i128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.mint(&user, &1000);
    }

    // ── Checkpoint tests ──────────────────────────────────────────

    #[test]
    fn test_latest_checkpoint_after_mint() {
        let (env, _admin, _cid, client) = setup();
        let user = Address::generate(&env);

        client.mint(&user, &500);

        let cp = client.latest_checkpoint(&user).unwrap();
        assert_eq!(cp.balance, 500);
    }

    #[test]
    fn test_latest_checkpoint_missing_holder_returns_none() {
        let (env, _admin, _cid, client) = setup();
        let unknown = Address::generate(&env);
        assert!(client.latest_checkpoint(&unknown).is_none());
    }

    #[test]
    fn test_checkpoint_history_bounded() {
        let (env, _admin, _cid, client) = setup();
        let user = Address::generate(&env);

        // Mint once — one checkpoint recorded.
        client.mint(&user, &100);

        // Burn some — second checkpoint (same ledger → overwrites).
        client.burn(&user, &40);

        // history with limit=1 should return only the latest.
        let hist = client.checkpoint_history(&user, &1);
        assert_eq!(hist.len(), 1);
        assert_eq!(hist.get(0).unwrap().balance, 60);
    }

    #[test]
    fn test_checkpoint_history_missing_holder_returns_empty() {
        let (env, _admin, _cid, client) = setup();
        let unknown = Address::generate(&env);
        let hist = client.checkpoint_history(&unknown, &10);
        assert_eq!(hist.len(), 0);
    }

    #[test]
    fn test_checkpoint_recorded_on_transfer() {
        let (env, _admin, _cid, client) = setup();
        let sender = Address::generate(&env);
        let receiver = Address::generate(&env);

        client.mint(&sender, &1000);
        client.transfer(&sender, &receiver, &300);

        let sender_cp = client.latest_checkpoint(&sender).unwrap();
        assert_eq!(sender_cp.balance, 700);

        let receiver_cp = client.latest_checkpoint(&receiver).unwrap();
        assert_eq!(receiver_cp.balance, 300);
    }
}
