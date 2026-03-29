# cross-chain-bridge

## Types

### `BridgeDirection`
Direction of a bridge request from the perspective of this (Stellar) chain.
- `Outbound = 0` — assets leave Stellar (`lock` or `burn_wrapped`).
- `Inbound = 1` — assets arrive on Stellar (`mint_wrapped` or `release`).

### `BridgeRequestStatus`
Lifecycle status of a bridge request.
- `Initiated = 0` — request created; awaiting remote-chain finalization.
- `Finalized = 1` — proof accepted and assets transferred.
- `Failed = 2` — request marked failed by admin (stuck or expired).

### `BridgeRequestSummary`
Full observable state of a single bridge request. Returned by `get_request` and
`get_inbound_finalization`. Never exposes validator keys or signature material.

```rust
pub struct BridgeRequestSummary {
    pub request_id:      u64,
    pub direction:       BridgeDirection,
    pub asset:           Address,
    pub amount:          i128,
    pub recipient_chain: Symbol,
    pub recipient:       String,
    pub status:          BridgeRequestStatus,
    pub proof:           BytesN<32>,
    pub ledger:          u32,
}
```

## Public Methods

### `init`
```rust
pub fn init(env: Env, admin: Address, validators: Vec<BytesN<32>>, quorum: u32) -> Result<(), Error>
```
Parameters: `env: Env`, `admin: Address`, `validators: Vec<BytesN<32>>`, `quorum: u32`
Return: `Result<(), Error>`

### `set_token_mapping`
```rust
pub fn set_token_mapping(env: Env, symbol: Symbol, asset: Address) -> Result<(), Error>
```
Parameters: `env: Env`, `symbol: Symbol`, `asset: Address`
Return: `Result<(), Error>`

### `set_paused`
```rust
pub fn set_paused(env: Env, paused: bool) -> Result<(), Error>
```
Parameters: `env: Env`, `paused: bool`
Return: `Result<(), Error>`

### `lock`
Lock native Stellar assets for outbound transfer. Assigns a sequential
`request_id` and stores an `Initiated` `BridgeRequestSummary`.
```rust
pub fn lock(env: Env, from: Address, asset: Address, amount: i128, recipient_chain: Symbol, recipient: String) -> Result<(), Error>
```
Parameters: `env: Env`, `from: Address`, `asset: Address`, `amount: i128`, `recipient_chain: Symbol`, `recipient: String`
Return: `Result<(), Error>`

### `mint_wrapped`
Mint wrapped assets for an inbound transfer. Verifies quorum, prevents replay,
and stores a `Finalized` `BridgeRequestSummary` keyed by `proof`.
```rust
pub fn mint_wrapped(env: Env, asset_symbol: Symbol, amount: i128, recipient: Address, proof: BytesN<32>, signatures: Map<BytesN<32>, BytesN<64>>) -> Result<(), Error>
```
Parameters: `env: Env`, `asset_symbol: Symbol`, `amount: i128`, `recipient: Address`, `proof: BytesN<32>`, `signatures: Map<BytesN<32>, BytesN<64>>`
Return: `Result<(), Error>`

### `burn_wrapped`
Burn wrapped assets for outbound transfer. Assigns a sequential `request_id`
and stores an `Initiated` `BridgeRequestSummary`.
```rust
pub fn burn_wrapped(env: Env, from: Address, asset: Address, amount: i128, recipient_chain: Symbol, recipient: String) -> Result<(), Error>
```
Parameters: `env: Env`, `from: Address`, `asset: Address`, `amount: i128`, `recipient_chain: Symbol`, `recipient: String`
Return: `Result<(), Error>`

### `release`
Release locked native assets for an inbound transfer. Verifies quorum, prevents
replay, and stores a `Finalized` `BridgeRequestSummary` keyed by `proof`.
```rust
pub fn release(env: Env, asset: Address, amount: i128, recipient: Address, proof: BytesN<32>, signatures: Map<BytesN<32>, BytesN<64>>) -> Result<(), Error>
```
Parameters: `env: Env`, `asset: Address`, `amount: i128`, `recipient: Address`, `proof: BytesN<32>`, `signatures: Map<BytesN<32>, BytesN<64>>`
Return: `Result<(), Error>`

### `get_request`
Return the full status summary for an outbound request by its sequential ID.
Returns `None` when the ID is unknown — callers should treat absence as
"not found". Never leaks validator keys or signature material.
```rust
pub fn get_request(env: Env, request_id: u64) -> Option<BridgeRequestSummary>
```
Parameters: `env: Env`, `request_id: u64`
Return: `Option<BridgeRequestSummary>`

### `get_inbound_finalization`
Return the finalization summary for an inbound operation identified by its
32-byte proof hash. Returns `None` if the proof has not been processed yet.
```rust
pub fn get_inbound_finalization(env: Env, proof: BytesN<32>) -> Option<BridgeRequestSummary>
```
Parameters: `env: Env`, `proof: BytesN<32>`
Return: `Option<BridgeRequestSummary>`

### `mark_request_failed`
Admin-only. Mark an outbound request as `Failed`. Intended for stuck or expired
requests. Returns `RequestNotFound` if `request_id` does not exist.
```rust
pub fn mark_request_failed(env: Env, request_id: u64) -> Result<(), Error>
```
Parameters: `env: Env`, `request_id: u64`
Return: `Result<(), Error>`
