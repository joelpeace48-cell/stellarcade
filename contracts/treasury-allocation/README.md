# Treasury Allocation Contract

The Treasury Allocation Contract is a budgeting and access-control layer that sits in front of the core `stellarcade-treasury` contract. It introduces spending buckets with configurable limits, a request-and-approve workflow, and deterministic on-chain event trails for every state transition.

---

## Methods

| Method | Auth | Description |
|---|---|---|
| `init(admin, treasury_contract)` | `admin` | One-time initialization. Stores admin + treasury address, seeds `NextRequestId = 1`. Fails with `AlreadyInitialized` on repeat calls. |
| `create_budget(bucket_id, limit, period)` | admin | Create or update a spending bucket. `limit` must be > 0. `period` is an opaque u64 (epoch seconds or ledger count — callers choose semantics). Emits `BudgetCreated`. |
| `request_allocation(requester, bucket_id, amount, reason) → u32` | `requester` | Submit an allocation request against a bucket. `amount` must be > 0. Returns the assigned `request_id`. Emits `AllocationRequested`. |
| `approve_allocation(request_id)` | admin | Approve a pending request. Checks budget headroom, increments `budget.allocated`, updates request to `Approved`, then invokes `treasury.allocate`. Emits `AllocationApproved`. |
| `reject_allocation(request_id)` | admin | Reject a pending request without touching the budget. Emits `AllocationRejected`. |
| `budget_state(bucket_id) → BudgetInfo` | — | Read-only. Returns `{ limit, allocated, period }`. Returns zeroed struct for unknown buckets. |
| `request_state(request_id) → RequestInfo` | — | Read-only. Returns request details or `RequestNotFound`. |
| `preview_allocation(bucket_id, amount) → AllocationPreview` | — | Read-only. Returns allocation outcome preview without modifying state. |

---

## Events

| Event | Topics | Data | Emitted by |
|---|---|---|---|
| `BudgetCreated` | `bucket_id` | `limit`, `period` | `create_budget` |
| `AllocationRequested` | `request_id` | `bucket_id`, `requester`, `amount` | `request_allocation` |
| `AllocationApproved` | `request_id` | `bucket_id`, `amount` | `approve_allocation` |
| `AllocationRejected` | `request_id` | `bucket_id` | `reject_allocation` |

---

## Storage Layout

| Key | Type | Storage | Description |
|---|---|---|---|
| `DataKey::Admin` | `Address` | `instance` | Contract admin |
| `DataKey::TreasuryContract` | `Address` | `instance` | Downstream treasury address |
| `DataKey::NextRequestId` | `u32` | `instance` | Monotonically increasing request counter |
| `DataKey::Budget(Symbol)` | `BudgetInfo` | `persistent` | Per-bucket spending limits and running total |
| `DataKey::AllocationRequest(u32)` | `RequestInfo` | `persistent` | Full lifecycle record per request |

### Data Structures

#### BudgetInfo
| Field | Type | Description |
|---|---|---|
| `limit` | `i128` | Maximum allocation for the bucket period |
| `allocated` | `i128` | Current total allocated from budget |
| `period` | `u64` | Budget period (caller-defined semantics) |

#### RequestInfo
| Field | Type | Description |
|---|---|---|
| `bucket_id` | `Symbol` | Target budget bucket |
| `requester` | `Address` | Address requesting allocation |
| `amount` | `i128` | Requested allocation amount |
| `reason` | `Symbol` | Purpose/reason for request |
| `status` | `RequestStatus` | `Pending`, `Approved`, or `Rejected` |

#### AllocationPreview
| Field | Type | Description |
|---|---|---|
| `bucket_id` | `Symbol` | Target budget bucket |
| `current_limit` | `i128` | Current budget limit |
| `current_allocated` | `i128` | Current allocated amount |
| `remaining_budget` | `i128` | Available budget remaining |
| `requested_amount` | `i128` | Amount being previewed |
| `would_exceed_budget` | `bool` | True if request exceeds remaining budget |
| `excess_amount` | `i128` | Amount over budget (0 if within budget) |
| `approval_likely` | `bool` | Likelihood of approval based on constraints |

All `persistent` entries are TTL-bumped to `518_400` ledgers on every write.

---

## Allocation Preview

The `preview_allocation` method provides a read-only preview of allocation outcomes without modifying contract state. This enables UI/UX improvements and better user experience by showing approval likelihood before users submit actual requests.

### Preview Behavior

- **Stateless**: Does not modify any contract storage
- **Deterministic**: Same inputs always produce same outputs
- **Real-time**: Reflects current budget state including pending allocations
- **Safe**: Can be called frequently without gas costs for state changes

### Approval Logic

The `approval_likely` field follows these rules:
- `false` if no budget exists for the bucket
- `false` if requested amount exceeds remaining budget
- `true` if within budget constraints and amount is reasonable

### Use Cases

```rust
// Check if request is likely to be approved
let preview = contract.preview_allocation(&symbol_short!("ops"), &500);
if preview.approval_likely {
    // Submit actual request
    let request_id = contract.request_allocation(&user, &symbol_short!("ops"), &500, &symbol_short!("server"));
} else {
    // Show user why it would be rejected
    display_error(format!("Request exceeds budget by {}", preview.excess_amount));
}
```

---

## Error Codes

| Code | Value | Meaning |
|---|---|---|
| `AlreadyInitialized` | 1 | `init` called on an already-initialized contract |
| `NotInitialized` | 2 | Method called before `init` |
| `NotAuthorized` | 3 | Caller is not the admin |
| `InvalidAmount` | 4 | Amount is zero or negative |
| `BudgetExceeded` | 5 | Approval would push `allocated` past `limit` |
| `RequestNotFound` | 6 | No request exists for the given `request_id` |
| `RequestAlreadyProcessed` | 7 | Request is not in `Pending` state |

---

## Invariants

- `init` can only succeed once (`AlreadyInitialized` guard).
- `budget.allocated` never exceeds `budget.limit` when a limit is set (checked atomically in `approve_allocation`).
- A request can only transition from `Pending → Approved` or `Pending → Rejected`; double-processing returns `RequestAlreadyProcessed`.
- `NextRequestId` is strictly monotone; request IDs are never reused.
- The treasury cross-contract call (`treasury.allocate`) fires **after** all local state mutations and the reentrancy-safe status update, preventing any double-execution.

---

## Integration Dependencies

- **`stellarcade-treasury`**: Must be deployed and initialized before this contract. The `TreasuryAllocation` contract address must be authorized as a caller on the treasury's `allocate` method (or the treasury's admin must be set to this contract) so the cross-contract invocation succeeds.
- **Authorization model**: `admin.require_auth()` is called on all privileged operations. In a production deployment, admin should be a multisig or governance contract.

### Cross-contract call signature expected on treasury

```rust
// treasury must expose:
pub fn allocate(env: Env, to_contract: Address, amount: i128, purpose: Symbol) -> Result<(), Error>
```

The call is made via `env.invoke_contract` using the `symbol_short!("allocate")` selector.

---

## Building & Testing

```bash
# From contracts/treasury-allocation
cargo build --target wasm32-unknown-unknown --release
cargo test
cargo clippy -- -D warnings
cargo fmt
```
