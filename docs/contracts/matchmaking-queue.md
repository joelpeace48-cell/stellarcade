# matchmaking-queue

## Public Methods

### `init`
Initialize the contract with an admin.

```rust
pub fn init(env: Env, admin: Address)
```

### `enqueue_player`
Enqueue a player into a matchmaking queue. Player must auth.

```rust
pub fn enqueue_player(env: Env, queue_id: Symbol, player: Address, criteria_hash: Symbol)
```

### `dequeue_player`
Remove a player from a queue. Only admin or the player themselves can dequeue.

```rust
pub fn dequeue_player(env: Env, caller: Address, queue_id: Symbol, player: Address)
```

### `create_match`
Create a match from a set of players. Admin-only. Players are removed from the queue on match creation.

```rust
pub fn create_match(env: Env, queue_id: Symbol, players: Vec<Address>) -> u64
```

### `queue_state`
Read the full current state of a queue. Missing queues still panic via `queue_state`; use the snapshot helpers for poll-friendly reads.

```rust
pub fn queue_state(env: Env, queue_id: Symbol) -> MatchQueueState
```

### `queue_depth`
Read the number of currently queued players. Missing or empty queues return `0`.

```rust
pub fn queue_depth(env: Env, queue_id: Symbol) -> u32
```

### `player_position_snapshot`
Read a deterministic, 1-based player position snapshot for the current queue ordering. Returns `None` when the queue is missing, the queue is empty, or the player is not currently queued.

```rust
pub fn player_position_snapshot(env: Env, queue_id: Symbol, player: Address) -> Option<QueuePositionSnapshot>
```

`QueuePositionSnapshot` includes:

- `queue_id`
- `player`
- `position`
- `queue_depth`
- `criteria_hash`

### `match_state`
Read a match record.

```rust
pub fn match_state(env: Env, match_id: u64) -> MatchRecord
```
