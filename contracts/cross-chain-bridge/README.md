# Cross-Chain Bridge Contract

This contract facilitates secure asset transfers between the Stellar network and
other supported blockchains.

## Features

- **Locking/Releasing**: For native Stellar assets.
- **Minting/Burning**: For wrapped assets representing tokens from other chains.
- **Validator Quorum**: Secure cross-chain verification via authorized validators.
- **Replay Protection**: Prevents double-spending using unique transfer proofs.
- **Request Tracking**: Per-request status and finalization metadata for full
  bridge observability without relying solely on event indexing.

## Methods

### Initialization

`init(admin, validators, quorum)` — Set up the initial bridge configuration.

### Outbound Transfers (assets leaving Stellar)

`lock(from, asset, amount, recipient_chain, recipient)` — Lock native assets to
be transferred cross-chain. Assigns a sequential `request_id` and stores an
`Initiated` request record.

`burn_wrapped(from, asset, amount, recipient_chain, recipient)` — Burn wrapped
assets to release them on their native chain. Assigns a sequential `request_id`
and stores an `Initiated` request record.

### Inbound Transfers (assets arriving on Stellar)

`mint_wrapped(asset_symbol, amount, recipient, proof, signatures)` — Mint
wrapped assets based on validator proof. Stores a `Finalized` inbound record
keyed by `proof`.

`release(asset, amount, recipient, proof, signatures)` — Release locked native
assets based on validator proof. Stores a `Finalized` inbound record keyed by
`proof`.

### Request Status Accessors

`get_request(request_id) → Option<BridgeRequestSummary>` — Return the full
status summary for an outbound request by its sequential ID. Returns `None` for
unknown IDs.

`get_inbound_finalization(proof) → Option<BridgeRequestSummary>` — Return the
finalization summary for an inbound operation by its 32-byte proof hash. Returns
`None` if the proof has not been processed.

`mark_request_failed(request_id) → Result<(), Error>` — Admin-only. Mark an
outbound request as `Failed` (e.g. stuck or expired). Returns `RequestNotFound`
if the ID does not exist.

### Configuration

`set_token_mapping(symbol, asset)` — Admin-only. Map a chain symbol to a
Stellar asset address.

`set_paused(paused)` — Admin-only. Pause or unpause all bridge operations.

## Request Lifecycle

```
Outbound (lock / burn_wrapped)
  └─ status: Initiated  ──► (admin) mark_request_failed ──► Failed

Inbound  (mint_wrapped / release)
  └─ status: Finalized  (written atomically with proof verification)
```

Request IDs for outbound requests are sequential `u64` values starting at `0`
and are stable across the full lifecycle. Inbound finalizations are indexed by
the 32-byte proof hash. Both accessors return `None` for unknown keys, ensuring
deterministic behaviour.

## BridgeRequestSummary Fields

| Field | Type | Description |
|---|---|---|
| `request_id` | `u64` | Sequential ID (outbound) or `0` (inbound) |
| `direction` | `BridgeDirection` | `Outbound` or `Inbound` |
| `asset` | `Address` | Stellar asset contract address |
| `amount` | `i128` | Token amount |
| `recipient_chain` | `Symbol` | Destination/source chain identifier |
| `recipient` | `String` | Remote recipient address (outbound) |
| `status` | `BridgeRequestStatus` | `Initiated`, `Finalized`, or `Failed` |
| `proof` | `BytesN<32>` | Proof hash (inbound) or zeroed sentinel (outbound) |
| `ledger` | `u32` | Ledger sequence at record creation |

## Security

- Quorum-based Ed25519 signature verification for all inbound transfers.
- Proof deduplication via `ProcessedProofs` to prevent replay attacks.
- Admin-controlled validator set and token mappings.
- Emergency pause functionality.
- Accessor methods never expose validator keys or raw signature material.

## Events

| Event | Topics | Extra Fields |
|---|---|---|
| `TokenLocked` | `asset`, `from` | `amount`, `recipient_chain`, `recipient`, `request_id` |
| `WrappedBurned` | `asset`, `from` | `amount`, `recipient_chain`, `recipient`, `request_id` |
| `WrappedMinted` | `asset_symbol`, `recipient` | `amount`, `proof` |
| `TokenReleased` | `asset`, `recipient` | `amount`, `proof` |
