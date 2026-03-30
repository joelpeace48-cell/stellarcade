# contract-monitoring

## Public Methods

### `init`
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

### `ingest_event`
```rust
pub fn ingest_event(env: Env, admin: Address, event_id: u64, kind: EventKind) -> Result<Metrics, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `event_id` | `u64` |
| `kind` | `EventKind` |

#### Return Type

`Result<Metrics, Error>`

### `set_paused`
```rust
pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `paused` | `bool` |

#### Return Type

`Result<(), Error>`

### `set_alert_thresholds`
```rust
pub fn set_alert_thresholds(env: Env, admin: Address, thresholds: AlertThresholds) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `thresholds` | `AlertThresholds` |

#### Return Type

`Result<(), Error>`

### `get_alert_thresholds`
```rust
pub fn get_alert_thresholds(env: Env) -> AlertThresholds
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`AlertThresholds`

### `get_metrics`
```rust
pub fn get_metrics(env: Env) -> Metrics
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Metrics`

### `get_health`
```rust
pub fn get_health(env: Env) -> HealthSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`HealthSnapshot`

### `get_snapshot`
```rust
pub fn get_snapshot(env: Env) -> MonitoringSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`MonitoringSnapshot`

### `get_sliding_window_metrics`
```rust
pub fn get_sliding_window_metrics(env: Env, window_seconds: u64) -> Result<Metrics, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `window_seconds` | `u64` |

#### Return Type

`Result<Metrics, Error>`

