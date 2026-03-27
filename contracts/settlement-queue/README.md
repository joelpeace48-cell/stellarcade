# Settlement Queue Contract

The Settlement Queue contract manages a FIFO queue of settlement requests for rewards and treasury allocations.

## Methods

### `init(admin: Address, reward_contract: Address, treasury_contract: Address)`
Initializes the contract with the admin and dependent contract addresses. Resets the queue head and tail pointers.

### `enqueue_settlement(settlement_id: Symbol, account: Address, amount: i128, reason: Symbol)`
Enqueues a new settlement request.
- **Authorization**: Admin or RewardContract.
- **Validation**: `settlement_id` must be unique.

### `process_next(batch_size: u32) -> u32`
Processes up to `batch_size` pending settlements from the queue.
- **Authorization**: Admin.
- **Logic**: Poppa items from FIFO queue, updates status to `Processed`.

### `mark_failed(settlement_id: Symbol, error_code: u32)`
Marks a pending settlement as failed with an error code.
- **Authorization**: Admin.

### `replay_settlement(admin: Address, settlement_id: Symbol)`
Replays a failed settlement by restoring it to `Pending` and appending the same
settlement identifier to the queue tail for reprocessing.
- **Authorization**: Admin.
- **Validation**: rejects missing, processed, pending, and processing records.

### `settlement_state(settlement_id: Symbol) -> Option<SettlementData>`
Returns the current state of a settlement.

### `queue_depth() -> u64`
Returns the current queue depth computed from `QueueTail - QueueHead`.

### `oldest_pending_settlement() -> Option<Symbol>`
Returns the oldest pending settlement id from the current queue window.

### `queue_metrics() -> QueueMetrics`
Returns queue depth and oldest pending settlement in a single read.

## Storage Model

- **Instance Storage**:
    - `Admin`: `Address`
    - `RewardContract`: `Address`
    - `TreasuryContract`: `Address`
    - `QueueHead`: `u64`
    - `QueueTail`: `u64`
- **Persistent Storage**:
    - `Settlement(settlement_id)`: `SettlementData`
    - `QueueItem(index)`: `Symbol` (points to `settlement_id`)

## Events

- `ContractInitialized`: Emitted on successful initialization.
- `SettlementEnqueued`: Emitted when a new settlement is added to the queue.
- `SettlementProcessed`: Emitted when a settlement is successfully processed.
- `SettlementFailed`: Emitted when a settlement is marked as failed.
- `SettlementReplayed`: Emitted when a failed settlement is requeued.

## Invariants

- `QueueHead <= QueueTail`
- Every `QueueItem` between `QueueHead` and `QueueTail` points to a valid `Settlement`.
- Total settlements processed/failed + pending = Total enqueued.
- Replay preserves the original `settlement_id`, account, amount, and reason.
