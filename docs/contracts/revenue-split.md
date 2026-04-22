# revenue-split

## Public Methods

### `init`
Initialize with admin and the token used for splits.

```rust
pub fn init(env: Env, admin: Address, token_address: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `token_address` | `Address` |

### `set_split_config`
Configure or update a split for a stream. Admin-only. Recipient weights must sum to exactly 10000 BPS.

```rust
pub fn set_split_config(env: Env, stream_id: Symbol, recipients: Vec<RecipientWeight>)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stream_id` | `Symbol` |
| `recipients` | `Vec<RecipientWeight>` |

### `deposit_revenue`
Deposit revenue into a stream. Any caller may deposit; they must auth.

```rust
pub fn deposit_revenue(env: Env, depositor: Address, stream_id: Symbol, amount: i128)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `depositor` | `Address` |
| `stream_id` | `Symbol` |
| `amount` | `i128` |

### `distribute`
Distribute all pending revenue in a stream to recipients. Admin-only.

```rust
pub fn distribute(env: Env, stream_id: Symbol)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stream_id` | `Symbol` |

### `preview_shares`
Preview how a prospective revenue amount would be split for a configured stream.
This accessor is read-only and uses the exact same integer math and remainder
handling as `distribute`.

```rust
pub fn preview_shares(env: Env, stream_id: Symbol, amount: i128) -> SharePreview
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stream_id` | `Symbol` |
| `amount` | `i128` |

#### Return Type

`SharePreview`

The returned `SharePreview` contains:

| Field | Type | Description |
|------|------|-------------|
| `stream_id` | `Symbol` | Requested stream identifier. |
| `amount` | `i128` | Prospective amount being previewed. |
| `distributed_total` | `i128` | Sum of all floored beneficiary share amounts. |
| `remainder` | `i128` | Undistributed amount left after rounding down beneficiary shares. |
| `shares` | `Vec<SharePreviewEntry>` | Per-beneficiary preview entries in configured order. |

Each `SharePreviewEntry` includes:

| Field | Type | Description |
|------|------|-------------|
| `recipient` | `Address` | Beneficiary address. |
| `weight_bps` | `u32` | Configured basis-point weight. |
| `share_amount` | `i128` | Amount this beneficiary would receive. |
| `remainder_numerator` | `i128` | Raw post-division remainder from `amount * weight_bps % 10000`. |
| `rounded_down` | `bool` | `true` when a fractional entitlement was truncated. |

### `get_split_state`
Read the current accrual snapshot for a configured stream.

```rust
pub fn get_split_state(env: Env, stream_id: Symbol) -> SplitAccrualSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stream_id` | `Symbol` |

#### Return Type

`SplitAccrualSnapshot`

The returned snapshot contains:

| Field | Type | Description |
|------|------|-------------|
| `stream_id` | `Symbol` | Requested stream identifier. |
| `pending_balance` | `i128` | Undistributed balance still held for the stream, including carried rounding remainder. |
| `accrued_total` | `i128` | Sum of all cumulative beneficiary accrual balances. |
| `accruals` | `Vec<BeneficiaryAccrual>` | Beneficiary balances in configured order. |

Each `BeneficiaryAccrual` includes:

| Field | Type | Description |
|------|------|-------------|
| `recipient` | `Address` | Beneficiary address. |
| `weight_bps` | `u32` | Configured basis-point weight. |
| `accrued_balance` | `i128` | Cumulative amount already distributed to that beneficiary for the stream. |

### `recipient_balance`
Query cumulative amount distributed to a recipient for a stream.

```rust
pub fn recipient_balance(env: Env, stream_id: Symbol, recipient: Address) -> i128
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `stream_id` | `Symbol` |
| `recipient` | `Address` |

#### Return Type

`i128`

## Rounding And Remainder Handling

- Beneficiary share math uses integer division on `amount * weight_bps / 10000`.
- When a beneficiary share is not evenly divisible, the fractional portion is truncated and reported through `rounded_down = true` plus the raw `remainder_numerator`.
- Any aggregate remainder left after summing all beneficiary `share_amount` values is returned as `SharePreview.remainder`.
- `distribute` keeps that aggregate remainder in `StreamBalance(stream_id)`, so it stays visible through `get_split_state.pending_balance` and can be released by later deposits instead of being lost.
- Preview and snapshot outputs are deterministic because both follow the configured recipient vector order.
