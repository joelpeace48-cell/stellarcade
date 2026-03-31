# leaderboard

## Public Methods

### `init`
Initialize the leaderboard contract with an admin.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

#### Return Type

`Result<(), Error>`

### `set_authorized`
Authorize or deauthorize an address (e.g., a game contract) to submit scores.

```rust
pub fn set_authorized(env: Env, admin: Address, addr: Address, auth: bool) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `addr` | `Address` |
| `auth` | `bool` |

#### Return Type

`Result<(), Error>`

### `set_game_active`
Set a game's active status.

```rust
pub fn set_game_active(env: Env, admin: Address, game_id: Symbol, active: bool) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `game_id` | `Symbol` |
| `active` | `bool` |

#### Return Type

`Result<(), Error>`

### `submit_score`
Submit a score for a player in a game. Only authorized callers can submit scores.

```rust
pub fn submit_score(env: Env, caller: Address, player: Address, game_id: Symbol, score: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `caller` | `Address` |
| `player` | `Address` |
| `game_id` | `Symbol` |
| `score` | `u64` |

#### Return Type

`Result<(), Error>`

### `update_rankings`
Explicitly request a ranking update for a game. In this implementation, it's mostly a placeholder as submit_score handles it, but can be used to re-validate the top list.

```rust
pub fn update_rankings(env: Env, game_id: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `top_players`
Get the top players for a game, up to a certain limit.

```rust
pub fn top_players(env: Env, game_id: Symbol, limit: u32) -> Result<Vec<ScoreEntry>, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |
| `limit` | `u32` |

#### Return Type

`Result<Vec<ScoreEntry>, Error>`

### `player_rank`
Get the rank of a player in a specific game (1-indexed). Returns 0 if player is not in the top leaderboard.

```rust
pub fn player_rank(env: Env, game_id: Symbol, player: Address) -> Result<u32, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |
| `player` | `Address` |

#### Return Type

`Result<u32, Error>`

### `player_rank_lookup`
Returns explicit rank lookup metadata for a player.

```rust
pub fn player_rank_lookup(env: Env, game_id: Symbol, player: Address) -> Result<PlayerRankLookup, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |
| `player` | `Address` |

#### Return Type

`Result<PlayerRankLookup, Error>`

### `neighboring_slice`
Returns entries around a ranked player with deterministic boundaries and ordering.

```rust
pub fn neighboring_slice(env: Env, game_id: Symbol, player: Address, radius: u32) -> Vec<ScoreEntry>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |
| `player` | `Address` |
| `radius` | `u32` |

#### Return Type

`Vec<ScoreEntry>`

## Missing Player Behavior

- `player_rank_lookup` returns `{ ranked: false, rank: 0 }`.
- `neighboring_slice` returns an empty vector.

### `get_player_score`
Get a player's raw score.

```rust
pub fn get_player_score(env: Env, game_id: Symbol, player: Address) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `Symbol` |
| `player` | `Address` |

#### Return Type

`u64`
