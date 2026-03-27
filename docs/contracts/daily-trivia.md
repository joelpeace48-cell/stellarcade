# daily-trivia

## Public Methods

### `init`
```rust
pub fn init(env: Env, admin: Address, prize_pool_contract: Address, balance_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `prize_pool_contract` | `Address` |
| `balance_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `open_round`
```rust
pub fn open_round(env: Env, round_id: u64, answer_commitment: BytesN<32>, reward_amount: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |
| `answer_commitment` | `BytesN<32>` |
| `reward_amount` | `i128` |

#### Return Type

`Result<(), Error>`

### `submit_answer`
```rust
pub fn submit_answer(env: Env, player: Address, round_id: u64, answer_payload: Bytes) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `round_id` | `u64` |
| `answer_payload` | `Bytes` |

#### Return Type

`Result<(), Error>`

### `close_round`
```rust
pub fn close_round(env: Env, round_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `claim_reward`
```rust
pub fn claim_reward(env: Env, player: Address, round_id: u64) -> Result<i128, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `round_id` | `u64` |

#### Return Type

`Result<i128, Error>`

### `get_round`
```rust
pub fn get_round(env: Env, round_id: u64) -> Option<RoundData>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`Option<RoundData>`

### `get_round_snapshot`
Returns a single snapshot for the latest known round.

```rust
pub fn get_round_snapshot(env: Env) -> Result<RoundSnapshot, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<RoundSnapshot, Error>`

### `reserve`
```rust
pub fn reserve(env: Env, _admin: Address, game_id: u64, amount: i128)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `_admin` | `Address` |
| `game_id` | `u64` |
| `amount` | `i128` |

### `release`
```rust
pub fn release(env: Env, _admin: Address, game_id: u64, amount: i128)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `_admin` | `Address` |
| `game_id` | `u64` |
| `amount` | `i128` |

### `payout`
```rust
pub fn payout(env: Env, _admin: Address, _to: Address, game_id: u64, amount: i128)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `_admin` | `Address` |
| `_to` | `Address` |
| `game_id` | `u64` |
| `amount` | `i128` |

### `set_balance`
```rust
pub fn set_balance(env: Env, user: Address, amount: i128)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `amount` | `i128` |

### `credit`
```rust
pub fn credit(env: Env, _game: Address, user: Address, amount: i128, _reason: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `_game` | `Address` |
| `user` | `Address` |
| `amount` | `i128` |
| `_reason` | `Symbol` |

### `debit`
```rust
pub fn debit(env: Env, _game: Address, user: Address, amount: i128, _reason: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `_game` | `Address` |
| `user` | `Address` |
| `amount` | `i128` |
| `_reason` | `Symbol` |

### `balance_of`
```rust
pub fn balance_of(env: Env, user: Address) -> i128
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`i128`

