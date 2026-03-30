# cross-contract-call-guard

## Public Methods

### `init`
Initialize the guard with an admin address.

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

### `allow_call`
Allow a specific cross-contract call. Admin only.

```rust
pub fn allow_call(env: Env, source: Address, target: Address, selector: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |
| `target` | `Address` |
| `selector` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `deny_call`
Deny (remove permission for) a specific cross-contract call. Admin only.

```rust
pub fn deny_call(env: Env, source: Address, target: Address, selector: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |
| `target` | `Address` |
| `selector` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `assert_allowed`
Assert that a call is allowed. Traps/Errs if not found or explicitly denied.

```rust
pub fn assert_allowed(env: Env, source: Address, target: Address, selector: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |
| `target` | `Address` |
| `selector` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `policy_state`
Check the state of a specific policy.

```rust
pub fn policy_state(env: Env, source: Address, target: Address, selector: Symbol) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |
| `target` | `Address` |
| `selector` | `Symbol` |

#### Return Type

`bool`

### `denied_audit`
Read-only accessor: returns the audit snapshot for a denied call, or None.

```rust
pub fn denied_audit(env: Env, source: Address, target: Address, selector: Symbol) -> Option<DeniedCallAudit>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |
| `target` | `Address` |
| `selector` | `Symbol` |

#### Return Type

`Option<DeniedCallAudit>`

### `rule_summary`
Read-only accessor: returns the count of active (allowed) rules for a source.

```rust
pub fn rule_summary(env: Env, source: Address) -> u32
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `source` | `Address` |

#### Return Type

`u32`

