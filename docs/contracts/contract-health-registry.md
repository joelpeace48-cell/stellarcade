# contract-health-registry

## Public Methods

### `init`
Initialize with the admin address.

```rust
pub fn init(env: Env, admin: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

### `report_health`
Report the health of a contract. The reporter must be authorized. Admin can report for any contract; other monitors must be pre-approved (future extension).

```rust
pub fn report_health(env: Env, reporter: Address, contract_id: Address, status: HealthStatus, details_hash: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `reporter` | `Address` |
| `contract_id` | `Address` |
| `status` | `HealthStatus` |
| `details_hash` | `Symbol` |

### `set_health_policy`
Set the health monitoring policy for a contract. Admin-only.

```rust
pub fn set_health_policy(env: Env, contract_id: Address, policy: HealthPolicy)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `contract_id` | `Address` |
| `policy` | `HealthPolicy` |

### `health_of`
Get the most recent health report for a contract.

```rust
pub fn health_of(env: Env, contract_id: Address) -> HealthReport
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `contract_id` | `Address` |

#### Return Type

`HealthReport`

### `history`
Get the full health history for a contract (up to max_history entries).

```rust
pub fn history(env: Env, contract_id: Address) -> Vec<HealthReport>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `contract_id` | `Address` |

#### Return Type

`Vec<HealthReport>`

### `heartbeat_freshness`
Return freshness information for a monitored contract heartbeat.

```rust
pub fn heartbeat_freshness(env: Env, contract_id: Address, stale_after_seconds: u64) -> HeartbeatFreshness
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `contract_id` | `Address` |
| `stale_after_seconds` | `u64` |

#### Return Type

`HeartbeatFreshness`

### `stale_contracts`
Return all tracked contracts whose latest heartbeat is older than the threshold.

```rust
pub fn stale_contracts(env: Env, stale_after_seconds: u64) -> Vec<Address>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stale_after_seconds` | `u64` |

#### Return Type

`Vec<Address>`

