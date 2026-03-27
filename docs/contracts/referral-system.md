# referral-system

Per-user referral state persisted on-chain.

## Public Methods

### `init`
Initializes the referral system contract.  * `admin`           – address that can call privileged methods. * `reward_contract` – address of the contract/account that funds rewards.

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

### `set_reward_bps`
Update the reward percentage (in basis points). Admin only.

```rust
pub fn set_reward_bps(env: Env, admin: Address, bps: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `bps` | `u32` |

#### Return Type

`Result<(), Error>`

### `set_reward_contract`
Update the reward contract address. Admin only.

```rust
pub fn set_reward_contract(env: Env, admin: Address, reward_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `reward_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `register_referrer`
Register `referrer` as the referrer of `user`.  * Both `user` and `referrer` must authorize the call. * A user cannot refer themselves. * A user can only be referred once.

```rust
pub fn register_referrer(env: Env, user: Address, referrer: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `referrer` | `Address` |

#### Return Type

`Result<(), Error>`

### `record_referral_event`
Record a referral event for `user`.  Called by an admin/operator when a qualifying action occurs (e.g. game played, deposit made). The `amount` is the transaction value and the reward is computed as `amount * reward_bps / 10_000`.  The reward is credited to the **referrer** of `user`.

```rust
pub fn record_referral_event(env: Env, admin: Address, user: Address, event_type: EventType, amount: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `user` | `Address` |
| `event_type` | `EventType` |
| `amount` | `i128` |

#### Return Type

`Result<(), Error>`

### `claim_referral_reward`
Claim all pending referral rewards for `user`.  Marks the pending balance as claimed. The actual token transfer is expected to be handled by the reward contract integration; this method records the accounting and emits an event for off-chain settlement or cross-contract calls.

```rust
pub fn claim_referral_reward(env: Env, user: Address) -> Result<i128, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`Result<i128, Error>`

### `referral_state`
Return the full referral state for a user.

```rust
pub fn referral_state(env: Env, user: Address) -> Result<ReferralState, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`Result<ReferralState, Error>`

### `get_referrer`
Return the referrer of a user, if any.

```rust
pub fn get_referrer(env: Env, user: Address) -> Option<Address>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`Option<Address>`

### `get_reward_contract`
Return the reward contract address.

```rust
pub fn get_reward_contract(env: Env) -> Result<Address, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<Address, Error>`

### `get_reward_bps`
Return the current reward basis points.

```rust
pub fn get_reward_bps(env: Env) -> Result<u32, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<u32, Error>`

### `preview_referral_reward`
Preview reward outcomes for a referral event without mutating storage.

```rust
pub fn preview_referral_reward(env: Env, user: Address, amount: i128) -> Result<ReferralRewardPreview, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |
| `amount` | `i128` |

#### Return Type

`Result<ReferralRewardPreview, Error>`

