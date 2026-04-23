#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, Env, Symbol, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    SplitConfig(Symbol),               // stream_id → SplitConfig
    StreamBalance(Symbol),             // stream_id → i128 (total deposited, not yet distributed)
    RecipientBalance(Symbol, Address), // (stream_id, recipient) → i128
}

// ── Domain Types ─────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientWeight {
    pub recipient: Address,
    /// Weight in basis points (0–10000). All recipients must sum to 10000.
    pub weight_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitConfig {
    pub stream_id: Symbol,
    pub recipients: Vec<RecipientWeight>,
}

/// Per-beneficiary share calculation returned by `preview_shares`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharePreviewEntry {
    pub recipient: Address,
    pub weight_bps: u32,
    pub share_amount: i128,
    /// The raw post-division remainder numerator (`amount * weight_bps % 10000`).
    pub remainder_numerator: i128,
    pub rounded_down: bool,
}

/// Read-only summary of how a prospective amount would be split.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharePreview {
    pub stream_id: Symbol,
    pub amount: i128,
    pub distributed_total: i128,
    /// Amount that remains pending because integer division truncated one or
    /// more recipient shares.
    pub remainder: i128,
    /// Entries are returned in the configured recipient order.
    pub shares: Vec<SharePreviewEntry>,
}

/// Current cumulative accrual for a configured beneficiary.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BeneficiaryAccrual {
    pub recipient: Address,
    pub weight_bps: u32,
    pub accrued_balance: i128,
}

/// Read-only snapshot of the stream's current split accounting state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitAccrualSnapshot {
    pub stream_id: Symbol,
    /// Undistributed balance still held by the contract for this stream,
    /// including any carried rounding remainder from prior distributions.
    pub pending_balance: i128,
    pub accrued_total: i128,
    /// Entries are returned in the configured recipient order.
    pub accruals: Vec<BeneficiaryAccrual>,
}

// ── Events ────────────────────────────────────────────────────────
#[contractevent]
pub struct SplitConfigured {
    #[topic]
    pub stream_id: Symbol,
}

#[contractevent]
pub struct RevenueDeposited {
    #[topic]
    pub stream_id: Symbol,
    pub amount: i128,
}

#[contractevent]
pub struct RevenueDistributed {
    #[topic]
    pub stream_id: Symbol,
    pub total: i128,
}

// ── Contract ──────────────────────────────────────────────────────
#[contract]
pub struct RevenueSplit;

#[contractimpl]
impl RevenueSplit {
    /// Initialize with admin and the token used for splits.
    pub fn init(env: Env, admin: Address, token_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Token, &token_address);
    }

    /// Configure or update a split for a stream. Admin-only.
    /// Recipient weights must sum to exactly 10000 BPS.
    pub fn set_split_config(env: Env, stream_id: Symbol, recipients: Vec<RecipientWeight>) {
        Self::require_admin(&env);
        assert!(!recipients.is_empty(), "Recipients cannot be empty");

        let mut total_bps: u32 = 0;
        for r in recipients.iter() {
            total_bps = total_bps
                .checked_add(r.weight_bps)
                .expect("Overflow in weight sum");
        }
        assert!(total_bps == 10_000, "Weights must sum to 10000 BPS");

        let config = SplitConfig {
            stream_id: stream_id.clone(),
            recipients,
        };
        env.storage()
            .persistent()
            .set(&DataKey::SplitConfig(stream_id.clone()), &config);

        SplitConfigured { stream_id }.publish(&env);
    }

    /// Deposit revenue into a stream. Any caller may deposit; they must auth.
    pub fn deposit_revenue(env: Env, depositor: Address, stream_id: Symbol, amount: i128) {
        assert!(amount > 0, "Amount must be positive");
        depositor.require_auth();

        // Ensure config exists
        assert!(
            env.storage()
                .persistent()
                .has(&DataKey::SplitConfig(stream_id.clone())),
            "Split config not found for stream"
        );

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&depositor, env.current_contract_address(), &amount);

        let current: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::StreamBalance(stream_id.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::StreamBalance(stream_id.clone()),
            &(current.checked_add(amount).expect("Overflow")),
        );

        RevenueDeposited { stream_id, amount }.publish(&env);
    }

    /// Distribute all pending revenue in a stream to recipients. Admin-only.
    pub fn distribute(env: Env, stream_id: Symbol) {
        Self::require_admin(&env);

        let config = Self::get_split_config(&env, stream_id.clone());

        let total: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::StreamBalance(stream_id.clone()))
            .unwrap_or(0);

        assert!(total > 0, "Nothing to distribute");

        let preview = Self::build_share_preview(&env, &config, stream_id.clone(), total);

        // Persist any rounding remainder before transfers (reentrancy guard).
        env.storage().persistent().set(
            &DataKey::StreamBalance(stream_id.clone()),
            &preview.remainder,
        );

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_addr);
        let contract_address = env.current_contract_address();

        for share in preview.shares.iter() {
            if share.share_amount > 0 {
                // Credit to recipient internal balance
                let bal_key = DataKey::RecipientBalance(stream_id.clone(), share.recipient.clone());
                let prev: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
                env.storage().persistent().set(
                    &bal_key,
                    &prev.checked_add(share.share_amount).expect("Overflow"),
                );

                // Immediate transfer
                token_client.transfer(&contract_address, &share.recipient, &share.share_amount);
            }
        }

        RevenueDistributed { stream_id, total }.publish(&env);
    }

    /// Query cumulative amount distributed to a recipient for a stream.
    pub fn recipient_balance(env: Env, stream_id: Symbol, recipient: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::RecipientBalance(stream_id, recipient))
            .unwrap_or(0)
    }

    /// Preview how a prospective amount would be split for a configured stream.
    /// The preview uses the exact same rounding logic as `distribute`.
    pub fn preview_shares(env: Env, stream_id: Symbol, amount: i128) -> SharePreview {
        assert!(amount >= 0, "Amount cannot be negative");
        let config = Self::get_split_config(&env, stream_id.clone());
        Self::build_share_preview(&env, &config, stream_id, amount)
    }

    /// Return a deterministic snapshot of current pending balance and
    /// cumulative beneficiary accruals for the stream.
    pub fn get_split_state(env: Env, stream_id: Symbol) -> SplitAccrualSnapshot {
        let config = Self::get_split_config(&env, stream_id.clone());
        let pending_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::StreamBalance(stream_id.clone()))
            .unwrap_or(0);

        let mut accrued_total: i128 = 0;
        let mut accruals = Vec::new(&env);

        for recipient in config.recipients.iter() {
            let accrued_balance: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::RecipientBalance(
                    stream_id.clone(),
                    recipient.recipient.clone(),
                ))
                .unwrap_or(0);

            accrued_total = accrued_total
                .checked_add(accrued_balance)
                .expect("Overflow");

            accruals.push_back(BeneficiaryAccrual {
                recipient: recipient.recipient.clone(),
                weight_bps: recipient.weight_bps,
                accrued_balance,
            });
        }

        SplitAccrualSnapshot {
            stream_id,
            pending_balance,
            accrued_total,
            accruals,
        }
    }

    // ── Internal ─────────────────────────────────────────────────
    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
    }

    fn get_split_config(env: &Env, stream_id: Symbol) -> SplitConfig {
        env.storage()
            .persistent()
            .get(&DataKey::SplitConfig(stream_id))
            .expect("Split config not found")
    }

    fn build_share_preview(
        env: &Env,
        config: &SplitConfig,
        stream_id: Symbol,
        amount: i128,
    ) -> SharePreview {
        let mut distributed_total: i128 = 0;
        let mut shares = Vec::new(env);

        for recipient in config.recipients.iter() {
            let numerator = amount
                .checked_mul(recipient.weight_bps as i128)
                .expect("Overflow");
            let share_amount = numerator.checked_div(10_000).expect("Division by zero");
            let remainder_numerator = numerator.checked_rem(10_000).expect("Division by zero");

            distributed_total = distributed_total
                .checked_add(share_amount)
                .expect("Overflow");

            shares.push_back(SharePreviewEntry {
                recipient: recipient.recipient.clone(),
                weight_bps: recipient.weight_bps,
                share_amount,
                remainder_numerator,
                rounded_down: remainder_numerator > 0,
            });
        }

        let remainder = amount.checked_sub(distributed_total).expect("Overflow");

        SharePreview {
            stream_id,
            amount,
            distributed_total,
            remainder,
            shares,
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        vec, Env, Symbol,
    };

    fn setup_token<'a>(
        env: &Env,
        admin: &Address,
    ) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let addr = sac.address();
        (
            addr.clone(),
            StellarAssetClient::new(env, &addr),
            TokenClient::new(env, &addr),
        )
    }

    #[test]
    fn test_configure_deposit_distribute() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let depositor = Address::generate(&env);

        let (token_id, sa, tc) = setup_token(&env, &admin);
        sa.mint(&depositor, &1000);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);

        client.init(&admin, &token_id);

        let stream = Symbol::new(&env, "gaming");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r1.clone(),
                weight_bps: 6000,
            },
            RecipientWeight {
                recipient: r2.clone(),
                weight_bps: 4000,
            },
        ];
        client.set_split_config(&stream, &recipients);

        client.deposit_revenue(&depositor, &stream, &1000);
        assert_eq!(tc.balance(&contract_id), 1000);

        client.distribute(&stream);
        assert_eq!(tc.balance(&r1), 600);
        assert_eq!(tc.balance(&r2), 400);

        assert_eq!(client.recipient_balance(&stream, &r1), 600);
        assert_eq!(client.recipient_balance(&stream, &r2), 400);

        let snapshot = client.get_split_state(&stream);
        assert_eq!(snapshot.pending_balance, 0);
        assert_eq!(snapshot.accrued_total, 1000);
        assert_eq!(snapshot.accruals.len(), 2);
        assert_eq!(snapshot.accruals.get(0).unwrap().recipient, r1);
        assert_eq!(snapshot.accruals.get(1).unwrap().recipient, r2);
    }

    #[test]
    #[should_panic(expected = "Weights must sum to 10000 BPS")]
    fn test_invalid_weight_sum_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token);

        let stream = Symbol::new(&env, "bad");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r1,
                weight_bps: 5000,
            }, // Only 50%, not 100%
        ];
        client.set_split_config(&stream, &recipients);
    }

    #[test]
    #[should_panic(expected = "Nothing to distribute")]
    fn test_distribute_empty_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token);

        let stream = Symbol::new(&env, "empty");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r1,
                weight_bps: 10000,
            },
        ];
        client.set_split_config(&stream, &recipients);
        client.distribute(&stream);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_init_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token);
        client.init(&admin, &token);
    }

    #[test]
    fn test_preview_shares_matches_distribution_and_reports_rounding() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        let depositor = Address::generate(&env);

        let (token_id, sa, tc) = setup_token(&env, &admin);
        sa.mint(&depositor, &101);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token_id);

        let stream = Symbol::new(&env, "rounding");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r1.clone(),
                weight_bps: 5000,
            },
            RecipientWeight {
                recipient: r2.clone(),
                weight_bps: 3000,
            },
            RecipientWeight {
                recipient: r3.clone(),
                weight_bps: 2000,
            },
        ];
        client.set_split_config(&stream, &recipients);

        let preview = client.preview_shares(&stream, &101);
        assert_eq!(preview.amount, 101);
        assert_eq!(preview.distributed_total, 100);
        assert_eq!(preview.remainder, 1);
        assert_eq!(preview.shares.len(), 3);
        assert_eq!(preview.shares.get(0).unwrap().recipient, r1.clone());
        assert_eq!(preview.shares.get(0).unwrap().share_amount, 50);
        assert_eq!(preview.shares.get(0).unwrap().remainder_numerator, 5000);
        assert!(preview.shares.get(0).unwrap().rounded_down);
        assert_eq!(preview.shares.get(1).unwrap().recipient, r2.clone());
        assert_eq!(preview.shares.get(1).unwrap().share_amount, 30);
        assert_eq!(preview.shares.get(1).unwrap().remainder_numerator, 3000);
        assert!(preview.shares.get(1).unwrap().rounded_down);
        assert_eq!(preview.shares.get(2).unwrap().recipient, r3.clone());
        assert_eq!(preview.shares.get(2).unwrap().share_amount, 20);
        assert_eq!(preview.shares.get(2).unwrap().remainder_numerator, 2000);
        assert!(preview.shares.get(2).unwrap().rounded_down);

        client.deposit_revenue(&depositor, &stream, &101);
        client.distribute(&stream);

        assert_eq!(tc.balance(&r1), 50);
        assert_eq!(tc.balance(&r2), 30);
        assert_eq!(tc.balance(&r3), 20);
        assert_eq!(tc.balance(&contract_id), 1);

        let snapshot = client.get_split_state(&stream);
        assert_eq!(snapshot.pending_balance, 1);
        assert_eq!(snapshot.accrued_total, 100);
        assert_eq!(snapshot.accruals.get(0).unwrap().accrued_balance, 50);
        assert_eq!(snapshot.accruals.get(1).unwrap().accrued_balance, 30);
        assert_eq!(snapshot.accruals.get(2).unwrap().accrued_balance, 20);
    }

    #[test]
    fn test_get_split_state_returns_deterministic_accrual_order() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        let depositor = Address::generate(&env);

        let (token_id, sa, _) = setup_token(&env, &admin);
        sa.mint(&depositor, &1000);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token_id);

        let stream = Symbol::new(&env, "ordered");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r2.clone(),
                weight_bps: 2000,
            },
            RecipientWeight {
                recipient: r1.clone(),
                weight_bps: 5000,
            },
            RecipientWeight {
                recipient: r3.clone(),
                weight_bps: 3000,
            },
        ];
        client.set_split_config(&stream, &recipients);

        client.deposit_revenue(&depositor, &stream, &1000);
        let pending_snapshot = client.get_split_state(&stream);
        assert_eq!(pending_snapshot.pending_balance, 1000);
        assert_eq!(pending_snapshot.accrued_total, 0);
        assert_eq!(pending_snapshot.accruals.len(), 3);
        assert_eq!(
            pending_snapshot.accruals.get(0).unwrap().recipient,
            r2.clone()
        );
        assert_eq!(
            pending_snapshot.accruals.get(1).unwrap().recipient,
            r1.clone()
        );
        assert_eq!(
            pending_snapshot.accruals.get(2).unwrap().recipient,
            r3.clone()
        );
        assert_eq!(pending_snapshot.accruals.get(0).unwrap().accrued_balance, 0);
        assert_eq!(pending_snapshot.accruals.get(1).unwrap().accrued_balance, 0);
        assert_eq!(pending_snapshot.accruals.get(2).unwrap().accrued_balance, 0);

        client.distribute(&stream);

        let settled_snapshot = client.get_split_state(&stream);
        assert_eq!(settled_snapshot.pending_balance, 0);
        assert_eq!(settled_snapshot.accrued_total, 1000);
        assert_eq!(settled_snapshot.accruals.get(0).unwrap().recipient, r2);
        assert_eq!(
            settled_snapshot.accruals.get(0).unwrap().accrued_balance,
            200
        );
        assert_eq!(settled_snapshot.accruals.get(1).unwrap().recipient, r1);
        assert_eq!(
            settled_snapshot.accruals.get(1).unwrap().accrued_balance,
            500
        );
        assert_eq!(settled_snapshot.accruals.get(2).unwrap().recipient, r3);
        assert_eq!(
            settled_snapshot.accruals.get(2).unwrap().accrued_balance,
            300
        );
    }

    #[test]
    fn test_rounding_remainder_carries_forward_across_distributions() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let r1 = Address::generate(&env);
        let r2 = Address::generate(&env);
        let r3 = Address::generate(&env);
        let depositor = Address::generate(&env);

        let (token_id, sa, tc) = setup_token(&env, &admin);
        sa.mint(&depositor, &200);

        let contract_id = env.register(RevenueSplit, ());
        let client = RevenueSplitClient::new(&env, &contract_id);
        client.init(&admin, &token_id);

        let stream = Symbol::new(&env, "carry");
        let recipients = vec![
            &env,
            RecipientWeight {
                recipient: r1.clone(),
                weight_bps: 5000,
            },
            RecipientWeight {
                recipient: r2.clone(),
                weight_bps: 3000,
            },
            RecipientWeight {
                recipient: r3.clone(),
                weight_bps: 2000,
            },
        ];
        client.set_split_config(&stream, &recipients);

        client.deposit_revenue(&depositor, &stream, &101);
        client.distribute(&stream);

        let after_first = client.get_split_state(&stream);
        assert_eq!(after_first.pending_balance, 1);
        assert_eq!(after_first.accruals.get(0).unwrap().accrued_balance, 50);
        assert_eq!(after_first.accruals.get(1).unwrap().accrued_balance, 30);
        assert_eq!(after_first.accruals.get(2).unwrap().accrued_balance, 20);

        client.deposit_revenue(&depositor, &stream, &99);
        client.distribute(&stream);

        let after_second = client.get_split_state(&stream);
        assert_eq!(after_second.pending_balance, 0);
        assert_eq!(after_second.accrued_total, 200);
        assert_eq!(after_second.accruals.get(0).unwrap().accrued_balance, 100);
        assert_eq!(after_second.accruals.get(1).unwrap().accrued_balance, 60);
        assert_eq!(after_second.accruals.get(2).unwrap().accrued_balance, 40);

        assert_eq!(tc.balance(&r1), 100);
        assert_eq!(tc.balance(&r2), 60);
        assert_eq!(tc.balance(&r3), 40);
        assert_eq!(tc.balance(&contract_id), 0);
    }
}
