#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, vec,
    Address, Env, IntoVal, Symbol,
};

pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidAmount = 4,
    BudgetExceeded = 5,
    RequestNotFound = 6,
    RequestAlreadyProcessed = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    TreasuryContract,
    NextRequestId,
    Budget(Symbol),
    AllocationRequest(u32),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BudgetInfo {
    pub limit: i128,
    pub allocated: i128,
    pub period: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RequestStatus {
    Pending,
    Approved,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestInfo {
    pub bucket_id: Symbol,
    pub requester: Address,
    pub amount: i128,
    pub reason: Symbol,
    pub status: RequestStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllocationPreview {
    pub bucket_id: Symbol,
    pub current_limit: i128,
    pub current_allocated: i128,
    pub remaining_budget: i128,
    pub requested_amount: i128,
    pub would_exceed_budget: bool,
    pub excess_amount: i128,
    pub approval_likely: bool,
}

#[contractevent]
pub struct BudgetCreated {
    #[topic]
    pub bucket_id: Symbol,
    pub limit: i128,
    pub period: u64,
}

#[contractevent]
pub struct AllocationRequested {
    #[topic]
    pub request_id: u32,
    pub bucket_id: Symbol,
    pub requester: Address,
    pub amount: i128,
}

#[contractevent]
pub struct AllocationApproved {
    #[topic]
    pub request_id: u32,
    pub bucket_id: Symbol,
    pub amount: i128,
}

#[contractevent]
pub struct AllocationRejected {
    #[topic]
    pub request_id: u32,
    pub bucket_id: Symbol,
}

#[contract]
pub struct TreasuryAllocation;

#[contractimpl]
impl TreasuryAllocation {
    pub fn init(env: Env, admin: Address, treasury_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryContract, &treasury_contract);
        env.storage().instance().set(&DataKey::NextRequestId, &1u32);

        Ok(())
    }

    pub fn create_budget(
        env: Env,
        bucket_id: Symbol,
        limit: i128,
        period: u64,
    ) -> Result<(), Error> {
        require_admin_as_invoker(&env)?;

        if limit <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Budget(bucket_id.clone());
        let mut info: BudgetInfo = env.storage().persistent().get(&key).unwrap_or(BudgetInfo {
            limit: 0,
            allocated: 0,
            period: 0,
        });

        info.limit = limit;
        info.period = period;

        env.storage().persistent().set(&key, &info);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        BudgetCreated {
            bucket_id,
            limit,
            period,
        }.publish(&env);

        Ok(())
    }

    pub fn request_allocation(
        env: Env,
        requester: Address,
        bucket_id: Symbol,
        amount: i128,
        reason: Symbol,
    ) -> Result<u32, Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        requester.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let request_id: u32 = env.storage().instance().get(&DataKey::NextRequestId).unwrap();

        let req = RequestInfo {
            bucket_id: bucket_id.clone(),
            requester: requester.clone(),
            amount,
            reason,
            status: RequestStatus::Pending,
        };

        let key = DataKey::AllocationRequest(request_id);
        env.storage().persistent().set(&key, &req);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        env.storage()
            .instance()
            .set(&DataKey::NextRequestId, &(request_id + 1));

        AllocationRequested {
            request_id,
            bucket_id,
            requester,
            amount,
        }.publish(&env);

        Ok(request_id)
    }

    pub fn approve_allocation(env: Env, request_id: u32) -> Result<(), Error> {
        require_admin_as_invoker(&env)?;

        let key = DataKey::AllocationRequest(request_id);
        let mut req: RequestInfo = env.storage().persistent().get(&key).ok_or(Error::RequestNotFound)?;

        if req.status != RequestStatus::Pending {
            return Err(Error::RequestAlreadyProcessed);
        }

        let budget_key = DataKey::Budget(req.bucket_id.clone());
        let mut budget: BudgetInfo = env.storage().persistent().get(&budget_key).unwrap_or(BudgetInfo {
            limit: 0,
            allocated: 0,
            period: 0,
        });

        if budget.limit > 0 && budget.allocated.checked_add(req.amount).unwrap_or(i128::MAX) > budget.limit {
            return Err(Error::BudgetExceeded);
        }

        // Update budget
        budget.allocated += req.amount;
        env.storage().persistent().set(&budget_key, &budget);
        env.storage()
            .persistent()
            .extend_ttl(&budget_key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        // Update request status
        req.status = RequestStatus::Approved;
        env.storage().persistent().set(&key, &req);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        // Call treasury contract natively
        let treasury: Address = env.storage().instance().get(&DataKey::TreasuryContract).unwrap();

        env.invoke_contract::<()>(
            &treasury,
            &symbol_short!("allocate"),
            vec![
                &env,
                req.requester.into_val(&env),
                req.amount.into_val(&env),
                req.reason.into_val(&env),
            ],
        );

        AllocationApproved {
            request_id,
            bucket_id: req.bucket_id,
            amount: req.amount,
        }.publish(&env);

        Ok(())
    }

    pub fn reject_allocation(env: Env, request_id: u32) -> Result<(), Error> {
        require_admin_as_invoker(&env)?;

        let key = DataKey::AllocationRequest(request_id);
        let mut req: RequestInfo = env.storage().persistent().get(&key).ok_or(Error::RequestNotFound)?;

        if req.status != RequestStatus::Pending {
            return Err(Error::RequestAlreadyProcessed);
        }

        req.status = RequestStatus::Rejected;
        env.storage().persistent().set(&key, &req);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        AllocationRejected {
            request_id,
            bucket_id: req.bucket_id,
        }.publish(&env);

        Ok(())
    }

    pub fn budget_state(env: Env, bucket_id: Symbol) -> Result<BudgetInfo, Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        let key = DataKey::Budget(bucket_id);
        let info = env.storage().persistent().get(&key).unwrap_or(BudgetInfo {
            limit: 0,
            allocated: 0,
            period: 0,
        });

        Ok(info)
    }

    pub fn request_state(env: Env, request_id: u32) -> Result<RequestInfo, Error> {
        let key = DataKey::AllocationRequest(request_id);
        env.storage().persistent().get(&key).ok_or(Error::RequestNotFound)
    }

    /// Preview allocation outcome without modifying state
    /// Returns detailed preview showing if request would exceed budget and approval likelihood
    pub fn preview_allocation(
        env: Env,
        bucket_id: Symbol,
        amount: i128,
    ) -> Result<AllocationPreview, Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let budget_key = DataKey::Budget(bucket_id.clone());
        let budget: BudgetInfo = env.storage().persistent().get(&budget_key).unwrap_or(BudgetInfo {
            limit: 0,
            allocated: 0,
            period: 0,
        });

        let remaining_budget = budget.limit.saturating_sub(budget.allocated);
        let would_exceed_budget = budget.limit > 0 && remaining_budget < amount;
        let excess_amount = if would_exceed_budget {
            amount.saturating_sub(remaining_budget)
        } else {
            0
        };
        
        // Approval likelihood based on budget constraints and amount reasonableness
        let approval_likely = !would_exceed_budget && amount <= budget.limit;

        Ok(AllocationPreview {
            bucket_id,
            current_limit: budget.limit,
            current_allocated: budget.allocated,
            remaining_budget,
            requested_amount: amount,
            would_exceed_budget,
            excess_amount,
            approval_likely,
        })
    }
}

fn require_admin_as_invoker(env: &Env) -> Result<(), Error> {
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::NotInitialized);
    }
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        symbol_short, Address, Env,
    };

    #[contract]
    pub struct MockTreasury;

    #[contractimpl]
    impl MockTreasury {
        pub fn allocate(_env: Env, _to_contract: Address, _amount: i128, _purpose: Symbol) {
            // No-op for testing cross-contract invocation
        }
    }

    fn setup(env: &Env) -> (TreasuryAllocationClient<'_>, Address, Address) {
        let admin = Address::generate(env);
        let treasury = env.register(MockTreasury, ());
        
        // Wait, Soroban tests register contracts natively and return a contract_id address.
        let contract_id = env.register(TreasuryAllocation, ());
        let client = TreasuryAllocationClient::new(env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &treasury);

        (client, admin, treasury)
    }

    #[test]
    fn test_init_sets_correct_state() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        env.mock_all_auths();
        
        let result = client.try_init(&admin, &Address::generate(&env));
        assert!(result.is_err());
    }

    #[test]
    fn test_create_budget() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &10_000, &30);
        let budget = client.budget_state(&symbol_short!("ops"));
        assert_eq!(budget.limit, 10_000);
        assert_eq!(budget.period, 30);
        assert_eq!(budget.allocated, 0);
    }

    #[test]
    fn test_request_allocation() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        let requester = Address::generate(&env);
        let req_id = client.request_allocation(
            &requester,
            &symbol_short!("ops"),
            &500,
            &symbol_short!("server")
        );
        
        assert_eq!(req_id, 1);
        let req = client.request_state(&req_id);
        assert_eq!(req.amount, 500);
        assert_eq!(req.status, RequestStatus::Pending);
    }

    #[test]
    fn test_approve_allocation_success() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);

        let requester = Address::generate(&env);
        let req_id = client.request_allocation(&requester, &symbol_short!("ops"), &500, &symbol_short!("server"));

        client.approve_allocation(&req_id);

        let req = client.request_state(&req_id);
        assert_eq!(req.status, RequestStatus::Approved);

        let budget = client.budget_state(&symbol_short!("ops"));
        assert_eq!(budget.allocated, 500);
    }

    #[test]
    fn test_approve_allocation_exceeds_budget() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);

        let requester = Address::generate(&env);
        let req_id = client.request_allocation(&requester, &symbol_short!("ops"), &1500, &symbol_short!("server"));

        let res = client.try_approve_allocation(&req_id);
        assert!(res.is_err());
    }

    #[test]
    fn test_reject_allocation() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        let requester = Address::generate(&env);
        let req_id = client.request_allocation(&requester, &symbol_short!("ops"), &500, &symbol_short!("server"));

        client.reject_allocation(&req_id);

        let req = client.request_state(&req_id);
        assert_eq!(req.status, RequestStatus::Rejected);
    }

    #[test]
    fn test_prevent_double_processing() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);
        let requester = Address::generate(&env);
        let req_id = client.request_allocation(&requester, &symbol_short!("ops"), &500, &symbol_short!("server"));

        client.approve_allocation(&req_id);

        let res1 = client.try_approve_allocation(&req_id);
        assert!(res1.is_err());

        let res2 = client.try_reject_allocation(&req_id);
        assert!(res2.is_err());
    }

    #[test]
    fn test_preview_allocation_within_budget() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);
        
        let preview = client.preview_allocation(&symbol_short!("ops"), &500);
        
        assert_eq!(preview.bucket_id, symbol_short!("ops"));
        assert_eq!(preview.current_limit, 1000);
        assert_eq!(preview.current_allocated, 0);
        assert_eq!(preview.remaining_budget, 1000);
        assert_eq!(preview.requested_amount, 500);
        assert!(!preview.would_exceed_budget);
        assert_eq!(preview.excess_amount, 0);
        assert!(preview.approval_likely);
    }

    #[test]
    fn test_preview_allocation_exceeds_budget() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);
        
        let preview = client.preview_allocation(&symbol_short!("ops"), &1500);
        
        assert_eq!(preview.bucket_id, symbol_short!("ops"));
        assert_eq!(preview.current_limit, 1000);
        assert_eq!(preview.current_allocated, 0);
        assert_eq!(preview.remaining_budget, 1000);
        assert_eq!(preview.requested_amount, 1500);
        assert!(preview.would_exceed_budget);
        assert_eq!(preview.excess_amount, 500);
        assert!(!preview.approval_likely);
    }

    #[test]
    fn test_preview_allocation_with_existing_allocations() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);
        
        // Approve one allocation first
        let requester = Address::generate(&env);
        let req_id = client.request_allocation(&requester, &symbol_short!("ops"), &300, &symbol_short!("server"));
        client.approve_allocation(&req_id);
        
        // Preview another allocation
        let preview = client.preview_allocation(&symbol_short!("ops"), &400);
        
        assert_eq!(preview.current_limit, 1000);
        assert_eq!(preview.current_allocated, 300);
        assert_eq!(preview.remaining_budget, 700);
        assert_eq!(preview.requested_amount, 400);
        assert!(!preview.would_exceed_budget);
        assert_eq!(preview.excess_amount, 0);
        assert!(preview.approval_likely);
    }

    #[test]
    fn test_preview_allocation_no_budget_exists() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        let preview = client.preview_allocation(&symbol_short!("none"), &500);
        
        assert_eq!(preview.bucket_id, symbol_short!("none"));
        assert_eq!(preview.current_limit, 0);
        assert_eq!(preview.current_allocated, 0);
        assert_eq!(preview.remaining_budget, 0);
        assert_eq!(preview.requested_amount, 500);
        assert!(!preview.would_exceed_budget); // No budget limit to exceed
        assert_eq!(preview.excess_amount, 0);
        assert!(!preview.approval_likely); // No budget exists
    }

    #[test]
    fn test_preview_allocation_invalid_amount() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        let result = client.try_preview_allocation(&symbol_short!("ops"), &0);
        assert!(result.is_err());

        let result = client.try_preview_allocation(&symbol_short!("ops"), &-100);
        assert!(result.is_err());
    }

    #[test]
    fn test_preview_allocation_uninitialized_contract() {
        let env = Env::default();
        let contract_id = env.register(TreasuryAllocation, ());
        let client = TreasuryAllocationClient::new(&env, &contract_id);
        
        let result = client.try_preview_allocation(&symbol_short!("ops"), &500);
        assert!(result.is_err());
    }

    #[test]
    fn test_preview_allocation_exact_budget_limit() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        env.mock_all_auths();

        client.create_budget(&symbol_short!("ops"), &1000, &30);
        
        let preview = client.preview_allocation(&symbol_short!("ops"), &1000);
        
        assert_eq!(preview.remaining_budget, 1000);
        assert_eq!(preview.requested_amount, 1000);
        assert!(!preview.would_exceed_budget);
        assert_eq!(preview.excess_amount, 0);
        assert!(preview.approval_likely);
    }
}
