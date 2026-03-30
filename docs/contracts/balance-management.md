# balance-management

## Public Methods

### `update_balance`
Update user balance (Internal use by other contracts).

```rust
pub fn update_balance(env: Env, user: Address, amount: i128, is_add: bool)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `amount` | `i128` |
| `is_add` | `bool` |

### `get_balance`
View user balance.

```rust
pub fn get_balance(env: Env, user: Address) -> i128
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`i128`

### `get_account_summary`
Returns a stable account snapshot for backend consumers.  If an account has never been written, `exists` is false and numeric fields are zeroed so unknown and zero-balance-known accounts are distinguishable.

```rust
pub fn get_account_summary(env: Env, user: Address) -> AccountSummary
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`AccountSummary`

