# achievement-badge

Definition of a badge, stored on-chain.  `criteria_hash` is a 32-byte SHA-256 hash of the off-chain criteria document, providing a tamper-evident commitment without on-chain verbosity. `reward` is an optional i128 amount to disburse via the reward contract when the badge is awarded; 0 means no reward.

## Public Methods

### `init`
Initialize the contract. May only be called once.  `admin` is the only address authorized to define badges, evaluate users, and award badges. `reward_contract` is the address of the downstream contract that handles token payouts (e.g., PrizePool). It is stored for future integration but is not called directly in this contract.

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

### `define_badge`
Define a new achievement badge. Admin only.  `badge_id` must be unique; re-defining an existing badge returns `BadgeAlreadyExists`. `criteria_hash` is the 32-byte SHA-256 hash of the off-chain criteria document. `reward` is the token amount awarded through the reward contract on badge issuance; use 0 for no reward.

```rust
pub fn define_badge(env: Env, admin: Address, badge_id: u64, criteria_hash: BytesN<32>, reward: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `badge_id` | `u64` |
| `criteria_hash` | `BytesN<32>` |
| `reward` | `i128` |

#### Return Type

`Result<(), Error>`

### `evaluate_user`
Signal that a user has been evaluated against a badge's criteria. Admin only.  This is an administrative action that emits an auditable event. It does not award the badge; call `award_badge` separately if the evaluation determines the user qualifies. The badge must exist.

```rust
pub fn evaluate_user(env: Env, admin: Address, user: Address, badge_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `user` | `Address` |
| `badge_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `award_badge`
Award `badge_id` to `user`. Admin only.  The badge must be defined. Each badge can only be awarded once per user; duplicate awards return `BadgeAlreadyAwarded`. The badge is appended to the user's persistent badge list, which is created on first award.  If `badge.reward > 0`, a `BadgeAwarded` event is emitted with the reward amount so off-chain services can trigger the downstream payout via the reward contract.

```rust
pub fn award_badge(env: Env, admin: Address, user: Address, badge_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `user` | `Address` |
| `badge_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `badges_of`
Return the list of badge IDs awarded to `user`.  Returns an empty list if the user has not been awarded any badges. Does not require initialization — a user with no badges trivially has an empty list regardless of contract state.

```rust
pub fn badges_of(env: Env, user: Address) -> Vec<u64>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `user` | `Address` |

#### Return Type

`Vec<u64>`

### `set_badge_metadata`
Attach or update human-readable metadata for an existing badge. Admin only. The badge must be defined first. Returns `BadgeNotFound` if `badge_id` is not defined.

```rust
pub fn set_badge_metadata(env: Env, admin: Address, badge_id: u64, title: String, description: String, award_rules: String) -> Result<(), Error>
```
Parameters: `env: Env`, `admin: Address`, `badge_id: u64`, `title: String`, `description: String`, `award_rules: String`
Return: `Result<(), Error>`

### `get_badge_summary`
Return a single-call snapshot combining the badge definition and its metadata, suitable for rendering a badge card without additional reads. When `badge_id` is unknown, `found` is `false` and all other fields carry zero/empty values.

```rust
pub fn get_badge_summary(env: Env, badge_id: u64) -> BadgeSummary
```
Parameters: `env: Env`, `badge_id: u64`
Return: `BadgeSummary`

### `get_claim_status`
Return the per-user claim-status snapshot for a `(user, badge_id)` pair. `badge_found` is `false` and `claimed` is `false` when the badge does not exist. `claimed` is `false` when the badge exists but has not been awarded to this user.

```rust
pub fn get_claim_status(env: Env, user: Address, badge_id: u64) -> ClaimStatusSnapshot
```
Parameters: `env: Env`, `user: Address`, `badge_id: u64`
Return: `ClaimStatusSnapshot`
