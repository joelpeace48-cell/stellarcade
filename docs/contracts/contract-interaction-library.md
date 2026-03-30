# contract-interaction-library

## Public Methods

### `init`
Initialise the library contract. Must be called once.

```rust
pub fn init(env: Env, admin: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

### `register_contract`
Register a contract under a human-readable `name` (1-32 chars, unique).

```rust
pub fn register_contract(env: Env, name: String, address: Address, version: u32)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |
| `address` | `Address` |
| `version` | `u32` |

### `deactivate_contract`
Deactivate a registered contract by name.

```rust
pub fn deactivate_contract(env: Env, name: String)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |

### `upgrade_contract`
Upgrade a registered contract to a new address + version.

```rust
pub fn upgrade_contract(env: Env, name: String, new_address: Address, new_version: u32)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |
| `new_address` | `Address` |
| `new_version` | `u32` |

### `get_contract`
Return the full registry entry for `name`.

```rust
pub fn get_contract(env: Env, name: String) -> ContractEntry
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |

#### Return Type

`ContractEntry`

### `resolve`
Resolve the address of an active registered contract.

```rust
pub fn resolve(env: Env, name: String) -> Address
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |

#### Return Type

`Address`

### `log_call`
Record a cross-contract call result and return its log ID.

```rust
pub fn log_call(env: Env, callee_name: String, caller: Address, success: bool) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `callee_name` | `String` |
| `caller` | `Address` |
| `success` | `bool` |

#### Return Type

`u64`

### `get_call_log`
Fetch a call log entry by ID.

```rust
pub fn get_call_log(env: Env, log_id: u64) -> CallRecord
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `log_id` | `u64` |

#### Return Type

`CallRecord`

### `read_prize_pool_config`
```rust
pub fn read_prize_pool_config(env: Env, address_registry: Address) -> Result<PrizePoolConfigSnapshot, CoreReadError>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `address_registry` | `Address` |

#### Return Type

`Result<PrizePoolConfigSnapshot, CoreReadError>`

### `read_balance_account_summary`
```rust
pub fn read_balance_account_summary(env: Env, address_registry: Address, user: Address) -> Result<AccountSummary, CoreReadError>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `address_registry` | `Address` |
| `user` | `Address` |

#### Return Type

`Result<AccountSummary, CoreReadError>`

### `resolve`
```rust
pub fn resolve(env: Env, name: String) -> Result<Address, MockRegistryError>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `name` | `String` |

#### Return Type

`Result<Address, MockRegistryError>`

### `get_config_snapshot`
```rust
pub fn get_config_snapshot(env: Env) -> Result<PrizePoolConfigSnapshot, PrizePoolReadError>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<PrizePoolConfigSnapshot, PrizePoolReadError>`

