# access-control

## Public Methods

### `init`
Initializes the contract with a super admin. This admin will have the power to grant and revoke any roles.

```rust
pub fn init(env: Env, admin: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

### `grant_role`
Grants a role to an account. Only accounts with ADMIN role (or the super admin) can call this.

```rust
pub fn grant_role(env: Env, role: Symbol, account: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `role` | `Symbol` |
| `account` | `Address` |

### `revoke_role`
Revokes a role from an account. Only accounts with ADMIN role can call this.

```rust
pub fn revoke_role(env: Env, role: Symbol, account: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `role` | `Symbol` |
| `account` | `Address` |

### `has_role`
Checks if an account has a specific role.

```rust
pub fn has_role(env: Env, role: Symbol, account: Address) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `role` | `Symbol` |
| `account` | `Address` |

#### Return Type

`bool`

### `get_admin`
Retrieves the current super admin address.

```rust
pub fn get_admin(env: Env) -> Address
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Address`

### `role_member_count`
Returns the number of accounts that currently hold the given role. Returns 0 for roles that have never been granted.

```rust
pub fn role_member_count(env: Env, role: Symbol) -> u32
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `role` | `Symbol` |

#### Return Type

`u32`

### `list_role_members`
Returns a bounded, deterministically-ordered slice of accounts that hold the given role.  Members are ordered by grant time (oldest first). Returns an empty vec for roles that have never been granted.

```rust
pub fn list_role_members(env: Env, role: Symbol, start: u32, limit: u32) -> Vec<Address>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `role` | `Symbol` |
| `start` | `u32` |
| `limit` | `u32` |

#### Return Type

`Vec<Address>`

### `require_admin`
```rust
pub fn require_admin(env: &Env)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |

### `require_role`
```rust
pub fn require_role(env: &Env, role: Symbol, account: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |
| `role` | `Symbol` |
| `account` | `Address` |

### `internal_grant_role`
```rust
pub fn internal_grant_role(env: &Env, role: Symbol, account: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |
| `role` | `Symbol` |
| `account` | `Address` |

### `internal_revoke_role`
```rust
pub fn internal_revoke_role(env: &Env, role: Symbol, account: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |
| `role` | `Symbol` |
| `account` | `Address` |

### `internal_has_role`
```rust
pub fn internal_has_role(env: &Env, role: Symbol, account: Address) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `&Env` |
| `role` | `Symbol` |
| `account` | `Address` |

#### Return Type

`bool`

