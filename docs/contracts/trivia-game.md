# trivia-game

## Public Methods

### `init`
Initialize the contract with the admin allowed to configure rounds.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), Error>
```

### `configure_round`
Configure a round and its question-set metadata. The stored metadata is safe
for pre-round display because it exposes only display fields such as category,
count, difficulty, and timing, not question content or answers.

```rust
pub fn configure_round(
    env: Env,
    admin: Address,
    round_id: u64,
    question_set_id: u64,
    question_count: u32,
    category: String,
    difficulty: u32,
    starts_at: u64,
    ends_at: u64,
) -> Result<(), Error>
```

### `activate_round`
Mark a configured round as active. Only one round is active at a time; if a
different round was active it is moved back to `Configured`.

```rust
pub fn activate_round(env: Env, admin: Address, round_id: u64) -> Result<(), Error>
```

### `submit_answer`
Submit an answer for the current active round. The contract records
participation and submission counters for snapshot reads.

```rust
pub fn submit_answer(env: Env, player: Address, question_id: u32, answer: String)
```

### `claim_reward`
Claim rewards for a correct answer.

```rust
pub fn claim_reward(_env: Env, player: Address, _game_id: u32)
```

### `question_set_metadata`
Return the configured question-set metadata for a round.

```rust
pub fn question_set_metadata(env: Env, round_id: u64) -> Result<QuestionSetMetadata, Error>
```

### `active_round_snapshot`
Return a deterministic snapshot of the active round.

If the contract has no active round, the snapshot is zeroed and
`has_active_round = false`.

```rust
pub fn active_round_snapshot(env: Env) -> ActiveRoundSnapshot
```

## Read Semantics

- `question_set_metadata` works for configured or active rounds and returns display-safe metadata only.
- `active_round_snapshot.is_accepting_answers` is derived from the configured start/end times and current ledger timestamp.
- Repeated reads in the same ledger state return the same snapshot values.
- The storage layout is round-based (`Round(round_id)` plus `ActiveRoundId`) so it can be extended to multi-round trivia flows later.
