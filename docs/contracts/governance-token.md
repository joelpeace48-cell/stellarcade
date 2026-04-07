# governance-token

## Public Methods

### `init`
Initializes the contract with the admin address and token setup. Requires admin authorization to prevent arbitrary initialization.

```rust
pub fn init(env: Env, admin: Address, name: String, symbol: String, decimals: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `name` | `String` |
| `symbol` | `String` |
| `decimals` | `u32` |

#### Return Type

`Result<(), Error>`

### `mint`
Mints new tokens to a recipient. Only admin can call.

```rust
pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `to` | `Address` |
| `amount` | `i128` |

#### Return Type

`Result<(), Error>`

### `burn`
Burns tokens from an account. Only admin can call.

```rust
pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `from` | `Address` |
| `amount` | `i128` |

#### Return Type

`Result<(), Error>`

### `transfer`
Transfers tokens between accounts. Requires sender authorization.

```rust
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `from` | `Address` |
| `to` | `Address` |
| `amount` | `i128` |

#### Return Type

`Result<(), Error>`

### `balance`
```rust
pub fn balance(env: Env, id: Address) -> i128
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `id` | `Address` |

#### Return Type

`i128`

### `total_supply`
```rust
pub fn total_supply(env: Env) -> i128
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`i128`

### `name`
```rust
pub fn name(env: Env) -> String
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`String`

### `symbol`
```rust
pub fn symbol(env: Env) -> String
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`String`

### `decimals`
```rust
pub fn decimals(env: Env) -> u32
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`u32`

### `latest_checkpoint`
Returns the most recent voting checkpoint for `holder`. Returns `None` when the holder has no recorded history.

```rust
pub fn latest_checkpoint(env: Env, holder: Address) -> Option<Checkpoint>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `holder` | `Address` |

#### Return Type

`Option<Checkpoint>`

### `checkpoint_history`
Returns up to `limit` most-recent checkpoints for `holder`, ordered oldest-first. `limit` is capped at 50. Returns an empty vec for unknown holders.

```rust
pub fn checkpoint_history(env: Env, holder: Address, limit: u32) -> Vec<Checkpoint>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `holder` | `Address` |
| `limit` | `u32` |

#### Return Type

`Vec<Checkpoint>`

## Checkpoint Type

```rust
pub struct Checkpoint {
    pub ledger: u32,   // Ledger sequence at which the snapshot was taken
    pub balance: i128, // Holder balance at that ledger
}
```

## Checkpoint Ordering & Retention

- Checkpoints are stored per holder in ascending ledger-sequence order (oldest → newest).
- Multiple balance changes within the same ledger overwrite the single entry for that ledger.
- A maximum of 50 checkpoints are retained per holder; the oldest is evicted when the cap is reached.
- Unknown holders return `None` (latest) or an empty list (history) — never an ambiguous zero state.

