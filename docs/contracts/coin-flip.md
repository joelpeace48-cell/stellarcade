# coin-flip

## Public Methods

### `init`
Initialize the coin flip game.  `house_edge_bps`: house edge in basis points (e.g., 250 = 2.5%).

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

### `place_bet`
Player places a bet. Tokens are transferred into the contract. A randomness request is submitted to the RNG contract.  `side`: 0 = Heads, 1 = Tails.

```rust
pub fn place_bet(env: Env, player: Address, side: u32, wager: i128, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `side` | `u32` |
| `wager` | `i128` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `resolve_bet`
Resolve a game after the oracle has fulfilled the RNG request. Anyone can call this — no auth needed since the outcome is deterministic.

```rust
pub fn resolve_bet(env: Env, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `get_game`
View a game's state.

```rust
pub fn get_game(env: Env, game_id: u64) -> Result<Game, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`Result<Game, Error>`

### `get_recent_games`
Return a bounded page of recent game ids for a player, ordered newest first.

```rust
pub fn get_recent_games(env: Env, player: Address, start: u32, limit: u32) -> Result<PlayerGameHistoryPage, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `start` | `u32` |
| `limit` | `u32` |

#### Return Type

`Result<PlayerGameHistoryPage, Error>`

