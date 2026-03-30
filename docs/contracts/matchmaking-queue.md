# matchmaking-queue

## Public Methods

### `init`
Initialize the contract with an admin.

```rust
pub fn init(env: Env, admin: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

### `enqueue_player`
Enqueue a player into a matchmaking queue. Player must auth.

```rust
pub fn enqueue_player(env: Env, queue_id: Symbol, player: Address, criteria_hash: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `queue_id` | `Symbol` |
| `player` | `Address` |
| `criteria_hash` | `Symbol` |

### `dequeue_player`
Remove a player from a queue. Only admin or the player themselves can dequeue.

```rust
pub fn dequeue_player(env: Env, caller: Address, queue_id: Symbol, player: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `caller` | `Address` |
| `queue_id` | `Symbol` |
| `player` | `Address` |

### `create_match`
Create a match from a set of players. Admin-only. Players are removed from the queue on match creation.

```rust
pub fn create_match(env: Env, queue_id: Symbol, players: Vec<Address>) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `queue_id` | `Symbol` |
| `players` | `Vec<Address>` |

#### Return Type

`u64`

### `queue_state`
Read the current state of a queue.

```rust
pub fn queue_state(env: Env, queue_id: Symbol) -> MatchQueueState
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `queue_id` | `Symbol` |

#### Return Type

`MatchQueueState`

### `queue_depth`
Read the number of players currently waiting in a queue. Missing queues report a depth of 0.

```rust
pub fn queue_depth(env: Env, queue_id: Symbol) -> u32
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `queue_id` | `Symbol` |

#### Return Type

`u32`

### `player_position_snapshot`
Read a stable player position snapshot for the current queue ordering. Returns None for missing queues, empty queues, or absent players.

```rust
pub fn player_position_snapshot(env: Env, queue_id: Symbol, player: Address) -> Option<QueuePositionSnapshot>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `queue_id` | `Symbol` |
| `player` | `Address` |

#### Return Type

`Option<QueuePositionSnapshot>`

### `match_state`
Read a match record.

```rust
pub fn match_state(env: Env, match_id: u64) -> MatchRecord
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `match_id` | `u64` |

#### Return Type

`MatchRecord`

