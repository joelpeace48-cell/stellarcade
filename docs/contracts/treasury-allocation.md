# treasury-allocation

## Public Methods

### `init`
```rust
pub fn init(env: Env, admin: Address, treasury_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `treasury_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `create_budget`
```rust
pub fn create_budget(env: Env, bucket_id: Symbol, limit: i128, period: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `bucket_id` | `Symbol` |
| `limit` | `i128` |
| `period` | `u64` |

#### Return Type

`Result<(), Error>`

### `request_allocation`
```rust
pub fn request_allocation(env: Env, requester: Address, bucket_id: Symbol, amount: i128, reason: Symbol) -> Result<u32, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `requester` | `Address` |
| `bucket_id` | `Symbol` |
| `amount` | `i128` |
| `reason` | `Symbol` |

#### Return Type

`Result<u32, Error>`

### `approve_allocation`
```rust
pub fn approve_allocation(env: Env, request_id: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `request_id` | `u32` |

#### Return Type

`Result<(), Error>`

### `reject_allocation`
```rust
pub fn reject_allocation(env: Env, request_id: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `request_id` | `u32` |

#### Return Type

`Result<(), Error>`

### `budget_state`
```rust
pub fn budget_state(env: Env, bucket_id: Symbol) -> Result<BudgetInfo, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `bucket_id` | `Symbol` |

#### Return Type

`Result<BudgetInfo, Error>`

### `request_state`
```rust
pub fn request_state(env: Env, request_id: u32) -> Result<RequestInfo, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `request_id` | `u32` |

#### Return Type

`Result<RequestInfo, Error>`

### `preview_allocation`
Preview allocation outcome without modifying state Returns detailed preview showing if request would exceed budget and approval likelihood

```rust
pub fn preview_allocation(env: Env, bucket_id: Symbol, amount: i128) -> Result<AllocationPreview, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `bucket_id` | `Symbol` |
| `amount` | `i128` |

#### Return Type

`Result<AllocationPreview, Error>`

### `allocate`
```rust
pub fn allocate(_env: Env, _to_contract: Address, _amount: i128, _purpose: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `_env` | `Env` |
| `_to_contract` | `Address` |
| `_amount` | `i128` |
| `_purpose` | `Symbol` |

