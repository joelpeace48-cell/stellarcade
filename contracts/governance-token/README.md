# Governance Token Contract

This contract implements the governance token for the StellarCade platform. It provides standard token functionalities such as minting, burning, and transferring, with administrative controls for governance purposes.

## Methods

### `init(admin: Address, token_config: TokenConfig)`
Initializes the contract with an admin address and token configuration.

### `mint(to: Address, amount: i128)`
Mints new tokens to the specified address. Requires admin authorization.

### `burn(from: Address, amount: i128)`
Burns tokens from the specified address. Requires admin authorization.

### `transfer(from: Address, to: Address, amount: i128)`
Transfers tokens from one address to another. Requires authorization from the sender.

### `total_supply() -> i128`
Returns the current total supply of tokens.

### `balance_of(owner: Address) -> i128`
Returns the token balance of the specified owner.

### `latest_checkpoint(holder: Address) -> Option<Checkpoint>`
Returns the most recent voting checkpoint for `holder`, or `None` if the holder has no recorded history. A checkpoint captures the holder's balance at a specific ledger sequence number.

### `checkpoint_history(holder: Address, limit: u32) -> Vec<Checkpoint>`
Returns up to `limit` most-recent checkpoints for `holder`, ordered oldest-first. `limit` is capped at 50. Returns an empty list for unknown holders.

## Checkpoint Behavior

- A `Checkpoint { ledger, balance }` is written whenever a holder's balance changes (mint, burn, or transfer).
- Checkpoints are ordered by ledger sequence (ascending) and the list is oldest-first.
- If two balance changes occur within the same ledger, the existing entry for that ledger is overwritten rather than duplicated.
- At most 50 checkpoints are retained per holder; the oldest entry is evicted when the cap is reached.
- Querying an unknown holder via either accessor returns a deterministic empty/`None` result — never an ambiguous zero state.

## Storage

- `Admin`: The address with administrative privileges.
- `TotalSupply`: Current total number of tokens in circulation.
- `Balances`: Mapping of addresses to their respective token balances.
- `Checkpoints`: Per-holder ordered list of `Checkpoint` entries (bounded to 50).

## Events

- `mint`: Emitted when new tokens are minted.
- `burn`: Emitted when tokens are burned.
- `transfer`: Emitted when tokens are transferred.
- `init`: Emitted when the contract is initialized.
