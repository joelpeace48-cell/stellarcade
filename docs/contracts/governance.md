# governance

## Public Methods

### `init`
Initialize governance with token and parameters.  `voting_period`: ledgers for voting (e.g., 17280 = ~1 day at 5s/ledger) `timelock_delay`: ledgers before execution (e.g., 86400 = ~5 days) `quorum_bps`: minimum participation (e.g., 400 = 4% of supply) `threshold_bps`: minimum approval (e.g., 6000 = 60% of votes cast)

```rust
pub fn init(env: Env, admin: Address, governance_token: Address, voting_period: u32, timelock_delay: u32, quorum_bps: u32, threshold_bps: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `governance_token` | `Address` |
| `voting_period` | `u32` |
| `timelock_delay` | `u32` |
| `quorum_bps` | `u32` |
| `threshold_bps` | `u32` |

#### Return Type

`Result<(), Error>`

### `propose`
Create a new proposal. Anyone can propose.  `payload_hash`: SHA-256 of the action to execute (verified at execution)

```rust
pub fn propose(env: Env, proposer: Address, proposal_id: u64, payload_hash: BytesN<32>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposer` | `Address` |
| `proposal_id` | `u64` |
| `payload_hash` | `BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `vote`
Cast a vote on an active proposal.  `support`: true = for, false = against `weight`: voter's token balance at time of vote (verified on-chain)

```rust
pub fn vote(env: Env, proposal_id: u64, voter: Address, support: bool) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |
| `voter` | `Address` |
| `support` | `bool` |

#### Return Type

`Result<(), Error>`

### `queue`
Queue a succeeded proposal into the timelock. Anyone can call.  Requirements: voting ended, quorum reached, threshold met

```rust
pub fn queue(env: Env, proposal_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `execute`
Execute a queued proposal after timelock. Anyone can call.  `payload_hash_verify`: must match stored hash (prevents bait-and-switch)

```rust
pub fn execute(env: Env, proposal_id: u64, payload_hash_verify: BytesN<32>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |
| `payload_hash_verify` | `BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `cancel`
Admin can cancel a proposal at any state (emergency function)

```rust
pub fn cancel(env: Env, admin: Address, proposal_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `proposal_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `cancel_stale`
Cancel a queued proposal that has exceeded the execution window.  ## Execution Window Rules - Queued proposals must be executed within `execution_window` ledgers after `eta` - Default execution window: 2x the timelock delay (e.g., if timelock=50 ledgers, window=100) - Anyone can call this function to clean up stale proposals - Prevents indefinite queue accumulation and governance stagnation  ## Requirements - Proposal must be in STATE_QUEUED - Current ledger must be >= eta + execution_window - Execution window = timelock_delay * 2 (conservative default)  ## Security - Cannot cancel active, executed, or already cancelled proposals - Prevents malicious actors from flooding the queue with stale proposals - Allows governance to remain responsive and current

```rust
pub fn cancel_stale(env: Env, proposal_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `get_proposal`
Get proposal details

```rust
pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |

#### Return Type

`Result<Proposal, Error>`

### `get_proposal_summary`
Return a display-ready proposal snapshot.  Missing proposals return `exists = false` with zeroed numeric fields so downstream callers can distinguish an empty-state from a real proposal.

```rust
pub fn get_proposal_summary(env: Env, proposal_id: u64) -> ProposalSummary
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |

#### Return Type

`ProposalSummary`

### `has_voted`
Check if an address has voted on a proposal

```rust
pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proposal_id` | `u64` |
| `voter` | `Address` |

#### Return Type

`bool`

