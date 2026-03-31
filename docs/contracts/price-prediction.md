# price-prediction

## Public Methods

### `init`
Initialize the price prediction game.  `house_edge_bps`: house edge in basis points (e.g., 500 = 5%).

```rust
pub fn init(env: Env, admin: Address, oracle_contract: Address, token: Address, min_wager: i128, max_wager: i128, house_edge_bps: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `oracle_contract` | `Address` |
| `token` | `Address` |
| `min_wager` | `i128` |
| `max_wager` | `i128` |
| `house_edge_bps` | `i128` |

#### Return Type

`Result<(), Error>`

### `open_market`
Open a new prediction market round. Admin only.  Queries the oracle for the current price of `asset` to set the opening price. `close_time` must be in the future.

```rust
pub fn open_market(env: Env, round_id: u64, asset: Symbol, close_time: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |
| `asset` | `Symbol` |
| `close_time` | `u64` |

#### Return Type

`Result<(), Error>`

### `place_prediction`
Player places a prediction on an open round.  `direction`: 0 = Up, 1 = Down. Tokens are transferred from the player to the contract as escrow. Each player may only bet once per round.

```rust
pub fn place_prediction(env: Env, player: Address, round_id: u64, direction: u32, wager: i128) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `round_id` | `u64` |
| `direction` | `u32` |
| `wager` | `i128` |

#### Return Type

`Result<(), Error>`

### `settle_round`
Settle a round after `close_time` has passed. Anyone can call this — the outcome is deterministic from the oracle.  A round is a push (all bets refunded) when: - Close price equals open price (flat market). - No bets were placed. - Only one side has bets (no opposing risk).

```rust
pub fn settle_round(env: Env, round_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `claim`
Claim winnings for a settled round. Winners receive their proportional share of the net pool. In a push round, all players receive a full refund of their wager.  Losers cannot claim (returns `NoPayout`).

```rust
pub fn claim(env: Env, player: Address, round_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `round_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `get_round`
View a round's state.

```rust
pub fn get_round(env: Env, round_id: u64) -> Result<RoundData, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`Result<RoundData, Error>`

### `get_bet`
View a player's bet in a round.

```rust
pub fn get_bet(env: Env, round_id: u64, player: Address) -> Result<BetData, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |
| `player` | `Address` |

#### Return Type

`Result<BetData, Error>`

### `participant_summary`
Return a compact and deterministic participant summary for a round.

Missing rounds return `has_round = false` with zero counters and an empty
`positions` list. Existing rounds return one entry per bettor in bet-placement
order, along with aggregate side counts and wager totals.

```rust
pub fn participant_summary(env: Env, round_id: u64) -> RoundParticipantSummary
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`RoundParticipantSummary`

### `settlement_preview`
Preview settlement using the round's current wager totals and the oracle's
current price feed.

Before final settlement this output is provisional and should be interpreted as
"if the round settled right now." Once a round is settled, the preview mirrors
the final stored result and returns `is_provisional = false`.

Missing rounds return `has_round = false` and zeroed numeric fields.

```rust
pub fn settlement_preview(env: Env, round_id: u64) -> SettlementPreview
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`SettlementPreview`
