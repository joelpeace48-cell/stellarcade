# ai-generated-game

## Public Methods

### `init`
Initialize the contract with the admin, AI model oracle address, and reward system address.

```rust
pub fn init(env: Env, admin: Address, model_oracle: Address, reward_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `model_oracle` | `Address` |
| `reward_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `create_ai_game`
Setup a new AI-generated game layout.

```rust
pub fn create_ai_game(env: Env, admin: Address, game_id: u64, config_hash: BytesN<32>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `game_id` | `u64` |
| `config_hash` | `BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `submit_ai_move`
Player submitting a move towards an active AI game.

```rust
pub fn submit_ai_move(env: Env, player: Address, game_id: u64, move_payload: String) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `game_id` | `u64` |
| `move_payload` | `String` |

#### Return Type

`Result<(), Error>`

### `resolve_ai_game`
Oracle node resolves the game securely mapping outputs and winners systematically.

```rust
pub fn resolve_ai_game(env: Env, oracle: Address, game_id: u64, result_payload: String, winner: Option<Address>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `oracle` | `Address` |
| `game_id` | `u64` |
| `result_payload` | `String` |
| `winner` | `Option<Address>` |

#### Return Type

`Result<(), Error>`

### `claim_ai_reward`
Authorizes player to claim rewards mapped after oracle validation finishes.

```rust
pub fn claim_ai_reward(env: Env, player: Address, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `get_session_snapshot`
Returns a stable, read-only snapshot of a session for client resume flows. No authentication required.

Returns a deterministic `Missing` snapshot when the `game_id` is unknown — callers never receive a hard error for a simple lookup. The snapshot exposes verification-friendly prompt metadata without leaking sensitive prompt internals, and remains stable for future moderation or review flows.

```rust
pub fn get_session_snapshot(env: Env, game_id: u64) -> SessionSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`SessionSnapshot`

#### SessionSnapshot Fields

| Field | Type | Description |
|-------|------|-------------|
| `game_id` | `u64` | The requested game identifier. |
| `status` | `SnapshotStatus` | `Missing`, `Active`, or `Completed`. |
| `prompt_hash` | `BytesN<32>` | SHA-256 commitment of the game config stored at creation. Zero-filled when `Missing`. |
| `winner` | `Option<Address>` | Set after oracle resolution; `None` while active or missing. |
| `has_winner` | `bool` | Convenience flag — `true` when `winner` is `Some`. |

#### SnapshotStatus Values

| Variant | Meaning |
|---------|---------|
| `Missing` | No session exists for the requested `game_id`. |
| `Active` | Session exists and is in `Created` or `InProgress` state. |
| `Completed` | Session has been resolved by the oracle. |

#### Redacted Fields

The following are intentionally absent from the snapshot to prevent sensitive data leakage:

- **Raw prompt / config payload** — never stored on-chain; only the SHA-256 hash is persisted.
- **Oracle result payload** — stored off-chain; not part of on-chain state.
- **Internal reward-claim flags** — private accounting detail; not relevant to session resume.
