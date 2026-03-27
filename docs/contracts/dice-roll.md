# dice-roll

## Public Methods

### `init`
Initialize the dice roll game.  `house_edge_bps`: house edge in basis points (e.g., 250 = 2.5%).

```rust
pub fn init(env: Env, admin: Address, rng_contract: Address, token: Address, min_wager: i128, max_wager: i128, house_edge_bps: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `rng_contract` | `Address` |
| `token` | `Address` |
| `min_wager` | `i128` |
| `max_wager` | `i128` |
| `house_edge_bps` | `i128` |

#### Return Type

`Result<(), Error>`

### `roll`
Player places a dice roll bet. Tokens are transferred into the contract. A randomness request is submitted to the RNG contract.  `prediction`: the die face the player predicts (1–6).

```rust
pub fn roll(env: Env, player: Address, prediction: u32, wager: i128, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `prediction` | `u32` |
| `wager` | `i128` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `resolve_roll`
Resolve a game after the oracle has fulfilled the RNG request. Anyone can call this — no auth needed since the outcome is deterministic.

```rust
pub fn resolve_roll(env: Env, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `get_roll`
View a roll's state.

```rust
pub fn get_roll(env: Env, game_id: u64) -> Result<Roll, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`Result<Roll, Error>`

### `set_wager_limits`
Admin-only update for the on-chain min and max wager settings.

```rust
pub fn set_wager_limits(env: Env, admin: Address, min_wager: i128, max_wager: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `min_wager` | `i128` |
| `max_wager` | `i128` |

#### Return Type

`Result<(), Error>`

### `get_wager_limits`
Read the current wager limits used during bet placement.

```rust
pub fn get_wager_limits(env: Env) -> Result<WagerLimits, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<WagerLimits, Error>`

