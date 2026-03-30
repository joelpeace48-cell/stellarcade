# emergency-pause

## Public Methods

### `init`
Initialize with an admin who can pause/unpause. Can only be called once.

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

### `pause`
Pause the contract with a reason code. Only callable by admin. Errors if already paused.

```rust
pub fn pause(env: Env, admin: Address, reason_code: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `reason_code` | `u32` |

#### Return Type

`Result<(), Error>`

### `unpause`
Unpause the contract. Only callable by admin. Errors if not paused.

```rust
pub fn unpause(env: Env, admin: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

#### Return Type

`Result<(), Error>`

### `is_paused`
Check if the contract is currently paused.

```rust
pub fn is_paused(env: Env) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`bool`

### `get_pause_metadata`
Get the current or latest pause metadata.

```rust
pub fn get_pause_metadata(env: Env) -> Option<PauseMetadata>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Option<PauseMetadata>`

### `paused_target_summary`
Returns a deterministic list of paused targets. The current contract only supports a single global pause target.

```rust
pub fn paused_target_summary(env: Env) -> Vec<PausedTargetSummary>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Vec<PausedTargetSummary>`

### `pause_window_snapshot`
Returns a side-effect free snapshot of the active pause window.

```rust
pub fn pause_window_snapshot(env: Env) -> PauseWindowSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`PauseWindowSnapshot`

### `require_not_paused`
Panics if the contract is paused. Call this at the top of any function that should be blocked during an emergency.  Usage from another contract: ```ignore use stellarcade_emergency_pause::require_not_paused; require_not_paused(&env); ```

```rust
pub fn require_not_paused(env: &Env)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |

### `is_paused_internal`
Read the pause flag from instance storage.

```rust
pub fn is_paused_internal(env: &Env) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |

#### Return Type

`bool`

