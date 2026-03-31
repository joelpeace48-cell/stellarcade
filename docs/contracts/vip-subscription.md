# vip-subscription

Definition of a VIP subscription plan.  `benefits_hash` is a 32-byte SHA-256 hash of the off-chain benefits document, providing a tamper-evident commitment without on-chain verbosity. `price` is the token amount charged per subscription period. `duration` is the subscription length in seconds.

## Public Methods

### `init`
Initialize the contract. May only be called once.  `admin` is the only address authorized to define plans. `treasury_contract` is the address that receives subscription payments.

```rust
pub fn init(env: Env, admin: Address, treasury_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `treasury_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `define_plan`
Define a new VIP subscription plan. Admin only.  `plan_id` must be unique; re-defining an existing plan returns `PlanAlreadyExists`. `price` must be positive. `duration` must be positive (in seconds). `benefits_hash` is the 32-byte SHA-256 hash of the off-chain benefits document.

```rust
pub fn define_plan(env: Env, admin: Address, plan_id: u32, price: i128, duration: u64, benefits_hash: BytesN<32>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `plan_id` | `u32` |
| `price` | `i128` |
| `duration` | `u64` |
| `benefits_hash` | `BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `subscribe`
Subscribe `user` to `plan_id`. The user pays the plan price via the treasury contract.  Rejected if the user already has an active (non-expired) subscription. Use `renew` to extend an active subscription. A user whose subscription has already expired may call `subscribe` again to start fresh.

```rust
pub fn subscribe(env: Env, user: Address, plan_id: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `plan_id` | `u32` |

#### Return Type

`Result<(), Error>`

### `renew`
Renew `user`'s subscription to `plan_id`. The user pays the plan price.  If the subscription is still active the duration is added to the current `expires_at` (so renewals always stack). If already expired, the new expiry is `now + duration`. The plan_id in the record is updated to match the renewed plan (allowing cross-plan renewal).  Rejected if no subscription record exists for the user.

```rust
pub fn renew(env: Env, user: Address, plan_id: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `plan_id` | `u32` |

#### Return Type

`Result<(), Error>`

### `status_of`
Return the subscription status for `user`.  Returns a `SubscriptionStatus` with `has_subscription = false` if the user has never subscribed. If a record exists, `is_active` reflects whether the current ledger timestamp is before `expires_at`.

```rust
pub fn status_of(env: Env, user: Address) -> SubscriptionStatus
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`SubscriptionStatus`

### `subscription_status`
Return a frontend-friendly subscription status for `user`.

This accessor explicitly separates:
- `NeverSubscribed` users with no stored record.
- `Active` users whose `expires_at` is still in the future.
- `Expired` users whose record remains on-chain for renewal and auditability.

```rust
pub fn subscription_status(env: Env, user: Address) -> UserSubscriptionStatus
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`UserSubscriptionStatus`

### `renewal_preview`
Preview the next renewal cost and timing for `user`.

This accessor is side-effect free. Active subscriptions preview stacked renewal
from the current `expires_at`; expired subscriptions preview reactivation from
the current ledger timestamp; never-subscribed users return `can_renew = false`
with zeroed cost and timing fields.

```rust
pub fn renewal_preview(env: Env, user: Address) -> RenewalPreview
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`RenewalPreview`
