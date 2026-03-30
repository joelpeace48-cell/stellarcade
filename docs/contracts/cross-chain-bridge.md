# cross-chain-bridge

Full observable state of a single bridge request.  For outbound requests the `proof` field is zeroed (not yet known on-chain). For inbound requests `request_id` is 0 and direction is `Inbound`.

## Public Methods

### `init`
```rust
pub fn init(env: Env, admin: Address, validators: Vec<BytesN<32>>, quorum: u32) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `validators` | `Vec<BytesN<32>>` |
| `quorum` | `u32` |

#### Return Type

`Result<(), Error>`

### `set_token_mapping`
```rust
pub fn set_token_mapping(env: Env, symbol: Symbol, asset: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `symbol` | `Symbol` |
| `asset` | `Address` |

#### Return Type

`Result<(), Error>`

### `set_paused`
```rust
pub fn set_paused(env: Env, paused: bool) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `paused` | `bool` |

#### Return Type

`Result<(), Error>`

### `lock`
```rust
pub fn lock(env: Env, from: Address, asset: Address, amount: i128, recipient_chain: Symbol, recipient: String) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `from` | `Address` |
| `asset` | `Address` |
| `amount` | `i128` |
| `recipient_chain` | `Symbol` |
| `recipient` | `String` |

#### Return Type

`Result<(), Error>`

### `mint_wrapped`
```rust
pub fn mint_wrapped(env: Env, asset_symbol: Symbol, amount: i128, recipient: Address, proof: BytesN<32>, signatures: Map<BytesN<32>, BytesN<64>>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `asset_symbol` | `Symbol` |
| `amount` | `i128` |
| `recipient` | `Address` |
| `proof` | `BytesN<32>` |
| `signatures` | `Map<BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `burn_wrapped`
```rust
pub fn burn_wrapped(env: Env, from: Address, asset: Address, amount: i128, recipient_chain: Symbol, recipient: String) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `from` | `Address` |
| `asset` | `Address` |
| `amount` | `i128` |
| `recipient_chain` | `Symbol` |
| `recipient` | `String` |

#### Return Type

`Result<(), Error>`

### `release`
```rust
pub fn release(env: Env, asset: Address, amount: i128, recipient: Address, proof: BytesN<32>, signatures: Map<BytesN<32>, BytesN<64>>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `asset` | `Address` |
| `amount` | `i128` |
| `recipient` | `Address` |
| `proof` | `BytesN<32>` |
| `signatures` | `Map<BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `get_request`
Return the full status summary for an outbound request by its sequential ID.  Returns `None` when the ID is unknown; callers should treat absence as "not found" rather than an error.  The summary never exposes validator keys or signature material.

```rust
pub fn get_request(env: Env, request_id: u64) -> Option<BridgeRequestSummary>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `request_id` | `u64` |

#### Return Type

`Option<BridgeRequestSummary>`

### `get_inbound_finalization`
Return the finalization summary for an inbound operation identified by its 32-byte proof hash.  Returns `None` when the proof has not been processed yet.

```rust
pub fn get_inbound_finalization(env: Env, proof: BytesN<32>) -> Option<BridgeRequestSummary>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `proof` | `BytesN<32>` |

#### Return Type

`Option<BridgeRequestSummary>`

### `mark_request_failed`
Admin-only: mark an outbound request as `Failed`.  Intended for stuck or expired requests that will never be finalized. Returns `RequestNotFound` if `request_id` does not exist.

```rust
pub fn mark_request_failed(env: Env, request_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `request_id` | `u64` |

#### Return Type

`Result<(), Error>`

