# contract-upgrade-timelock

Snapshot returned by `get_queued_upgrade`. `None` when no upgrade is queued (never queued or already cleared). When `Some`, `is_ready` is `true` iff the current ledger timestamp >= `eta`.

## Public Methods

### `init`
Initialize with admin and minimum timelock delay (seconds).

```rust
pub fn init(env: Env, admin: Address, min_delay: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `min_delay` | `u64` |

### `queue_upgrade`
Queue an upgrade proposal. Admin-only. `eta` must be at least `now + min_delay`.

```rust
pub fn queue_upgrade(env: Env, target_contract: Address, payload_hash: Symbol, eta: u64) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `target_contract` | `Address` |
| `payload_hash` | `Symbol` |
| `eta` | `u64` |

#### Return Type

`u64`

### `cancel_upgrade`
Cancel a queued upgrade. Admin-only.

```rust
pub fn cancel_upgrade(env: Env, upgrade_id: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `upgrade_id` | `u64` |

### `execute_upgrade`
Execute a queued upgrade after the timelock has elapsed. Admin-only.

```rust
pub fn execute_upgrade(env: Env, upgrade_id: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `upgrade_id` | `u64` |

### `upgrade_state`
Read the state of an upgrade record.

```rust
pub fn upgrade_state(env: Env, upgrade_id: u64) -> UpgradeRecord
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `upgrade_id` | `u64` |

#### Return Type

`UpgradeRecord`

### `get_queued_upgrade`
Returns a single-read snapshot of the queued upgrade for `upgrade_id`.  Returns `None` when no record exists or the upgrade is no longer in `Queued` status (executed or cancelled).  When `Some`, `is_ready` is `true` iff the current ledger timestamp has reached or passed `eta`.

```rust
pub fn get_queued_upgrade(env: Env, upgrade_id: u64) -> Option<QueuedUpgradeView>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `upgrade_id` | `u64` |

#### Return Type

`Option<QueuedUpgradeView>`

