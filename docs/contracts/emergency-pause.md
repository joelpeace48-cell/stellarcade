# emergency-pause

## Public Methods

### `init`
Initialize with an admin who can pause/unpause. Can only be called once.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), Error>
```

### `pause`
Pause the contract with a reason code. Only callable by admin. Errors if already paused.

```rust
pub fn pause(env: Env, admin: Address, reason_code: u32) -> Result<(), Error>
```

### `unpause`
Unpause the contract. Only callable by admin. Errors if not paused.

```rust
pub fn unpause(env: Env, admin: Address) -> Result<(), Error>
```

### `is_paused`
Check if the contract is currently paused.

```rust
pub fn is_paused(env: Env) -> bool
```

### `get_pause_metadata`
Get the current or latest pause metadata. Returns `None` before the first pause has ever been recorded.

```rust
pub fn get_pause_metadata(env: Env) -> Option<PauseMetadata>
```

### `paused_target_summary`
Read a deterministic summary of active paused targets. The current implementation exposes a single `"global"` target while paused and returns an empty list when unpaused or before initialization.

```rust
pub fn paused_target_summary(env: Env) -> Vec<PausedTargetSummary>
```

### `pause_window_snapshot`
Read a side-effect free snapshot of the active pause window. When unpaused or uninitialized, the snapshot reports `is_paused = false`, `active_target_count = 0`, and empty pause metadata fields.

```rust
pub fn pause_window_snapshot(env: Env) -> PauseWindowSnapshot
```

### `require_not_paused`
Panics if the contract is paused. Call this at the top of any function that should be blocked during an emergency.

```rust
pub fn require_not_paused(env: &Env)
```

### `is_paused_internal`
Read the pause flag from instance storage.

```rust
pub fn is_paused_internal(env: &Env) -> bool
```
