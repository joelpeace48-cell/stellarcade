# Matchmaking Queue Contract

Soroban smart contract for managing player matchmaking queues on-chain.

## Storage

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract administrator |
| `NextMatchId` | `u64` | Auto-incremented match ID |
| `QueueState(queue_id)` | `MatchQueueState` | Per-queue player list (persistent) |
| `Match(match_id)` | `MatchRecord` | Completed match record (persistent) |

## Methods

| Method | Auth | Description |
|--------|------|-------------|
| `init(admin)` | none | Initialize contract (once only) |
| `enqueue_player(queue_id, player, criteria_hash)` | player | Join a named queue; rejects duplicates |
| `dequeue_player(caller, queue_id, player)` | player or admin | Remove player from queue |
| `create_match(queue_id, players)` | admin | Form a match and remove players from queue |
| `queue_state(queue_id)` | none | Read current queue state |
| `queue_depth(queue_id)` | none | Read the active queue depth; missing queues return `0` |
| `player_position_snapshot(queue_id, player)` | none | Read a 1-based player position snapshot; returns `None` for empty queues or missing players |
| `match_state(match_id)` | none | Read a match record |

## Events

| Topic | Data | Trigger |
|-------|------|---------|
| `enqueued` | `PlayerEnqueued` | Player joins queue |
| `dequeued` | `PlayerDequeued` | Player leaves queue |
| `matched` | `MatchCreated` | Match formed |

## Invariants

- A player may not appear twice in the same queue.
- Only admin or the player themselves may dequeue.
- Match creation removes matched players from the queue atomically.
- Queue position snapshots remain stable between reads while the queue order is unchanged.
- Empty or missing queues report depth `0` and no player snapshot.

## Dependencies

- `soroban-sdk = "25.0.2"`
