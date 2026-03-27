# settlement-queue

## Public Methods

### `init`
Initialise the contract.

```rust
pub fn init(env: Env, admin: Address, reward_contract: Address, treasury_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `reward_contract` | `Address` |
| `treasury_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `enqueue_settlement`
Enqueue a new settlement.

```rust
pub fn enqueue_settlement(env: Env, settlement_id: Symbol, account: Address, amount: i128, reason: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `settlement_id` | `Symbol` |
| `account` | `Address` |
| `amount` | `i128` |
| `reason` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `process_next`
Process the next batch of settlements.

```rust
pub fn process_next(env: Env, batch_size: u32) -> Result<u32, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `batch_size` | `u32` |

#### Return Type

`Result<u32, Error>`

### `mark_failed`
Mark a settlement as failed.

```rust
pub fn mark_failed(env: Env, settlement_id: Symbol, error_code: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `settlement_id` | `Symbol` |
| `error_code` | `u32` |

#### Return Type

`Result<(), Error>`

### `replay_settlement`
Replay a failed settlement by restoring it to pending and appending it to the tail of the queue.

```rust
pub fn replay_settlement(env: Env, admin: Address, settlement_id: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `settlement_id` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `settlement_state`
Query the state of a settlement.

```rust
pub fn settlement_state(env: Env, settlement_id: Symbol) -> Option<SettlementData>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `settlement_id` | `Symbol` |

#### Return Type

`Option<SettlementData>`

### `get_batch_status`
Query current batch status by index range.

```rust
pub fn get_batch_status(env: Env, start_index: u64, end_index: u64) -> Result<BatchStatus, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `start_index` | `u64` |
| `end_index` | `u64` |

#### Return Type

`Result<BatchStatus, Error>`

### `queue_depth`
Return queue depth from the current head and tail pointers.

```rust
pub fn queue_depth(env: Env) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`u64`

### `oldest_pending_settlement`
Return the oldest pending settlement id, if any.

```rust
pub fn oldest_pending_settlement(env: Env) -> Option<Symbol>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Option<Symbol>`

### `queue_metrics`
Return both queue depth and the oldest pending marker in one read.

```rust
pub fn queue_metrics(env: Env) -> QueueMetrics
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`QueueMetrics`

