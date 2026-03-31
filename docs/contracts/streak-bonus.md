# streak-bonus

## Public Methods

### `init`
Initialize with admin and reward contract address. Call once.

```rust
pub fn init(env: Env, admin: Address, reward_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `reward_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `record_activity`
Record an activity for a user. Caller must be the user (require_auth) or admin.

```rust
pub fn record_activity(env: Env, caller: Address, user: Address, activity_type: Symbol, ts: u64) -> Result<u32, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `caller` | `Address` |
| `user` | `Address` |
| `activity_type` | `Symbol` |
| `ts` | `u64` |

#### Return Type

`Result<u32, Error>`

### `current_streak`
Return the current streak count for a user.

```rust
pub fn current_streak(env: Env, user: Address) -> u32
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`u32`

### `streak_summary`
Return a per-player streak summary at `as_of_ts`.

Missing players return `status = Missing` with all counters at `0`.
If the stored streak window has elapsed by `as_of_ts`, the summary returns
`status = Reset`, `active_streak = 0`, and preserves the previous
`last_recorded_streak` for UI messaging.

```rust
pub fn streak_summary(env: Env, user: Address, as_of_ts: u64) -> StreakSummary
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `as_of_ts` | `u64` |

#### Return Type

`StreakSummary`

### `next_bonus_preview`
Preview the next streak-bonus threshold and projected reward at `as_of_ts`.

The preview is deterministic for a given `as_of_ts`, side-effect free, and uses
the effective active streak so broken streaks render from `0` while still
retaining the player's historic `last_claimed_streak` progression.

```rust
pub fn next_bonus_preview(env: Env, user: Address, as_of_ts: u64) -> NextBonusPreview
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `as_of_ts` | `u64` |

#### Return Type

`NextBonusPreview`

### `claim_streak_bonus`
Claim streak bonus for the current streak. User must authorize. Updates last_claimed_streak.

```rust
pub fn claim_streak_bonus(env: Env, user: Address) -> Result<i128, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`Result<i128, Error>`

### `reset_rules`
Reset streak rules. Admin only.

```rust
pub fn reset_rules(env: Env, admin: Address, config: StreakRules) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `config` | `StreakRules` |

#### Return Type

`Result<(), Error>`

## Read Semantics

- `StreakSummary.status = Active` means the stored streak is still inside the configured streak window at `as_of_ts`.
- `StreakSummary.status = Reset` means the streak has timed out; `active_streak` is reset to `0` but `last_recorded_streak` still shows the prior stored value.
- `StreakSummary.status = Missing` means the player has no recorded activity yet.
- `NextBonusPreview.threshold_streak` is the next streak count that would unlock a new bonus under the current lifetime `last_claimed_streak` progression.
