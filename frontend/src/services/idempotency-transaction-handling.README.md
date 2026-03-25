# Idempotency Transaction Handling

Production-grade idempotency handling for repeat transaction requests in the Stellarcade frontend.

## Overview

This module provides client-side idempotency support that works in conjunction with the backend's idempotency middleware. It prevents duplicate transaction submissions, tracks request lifecycle state, and enables safe retry logic for failed or unknown-outcome requests.

## Components

1. **Types** (`types/idempotency.ts`) - Type definitions for idempotency keys, request states, and service interfaces
2. **Service** (`services/idempotency-transaction-handling.ts`) - Core idempotency service implementation

## How It Works

### Request Lifecycle

```
┌─────────┐    ┌────────────┐    ┌────────────┐    ┌───────────┐
│ PENDING │ -> │ IN_FLIGHT  │ -> │ COMPLETED   │    │           │
└─────────┘    └────────────┘    └───────────┘    │           │
     |                |                           │  SUCCESS  │
     |                |                           │           │
     |                └──────────┐                │           │
     |                           │                │           │
     v                           v                v           v
┌─────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐
│ FAILED  │ <- │  UNKNOWN   │ <- │ IN_FLIGHT │    │  FAILURE  │
└─────────┘    └────────────┘    └───────────┘    │           │
                (recoverable)                      │           │
                                                   └───────────┘
```

### State Descriptions

| State       | Description                                    | Mutable           |
| ----------- | ---------------------------------------------- | ----------------- |
| `PENDING`   | Request created, not yet submitted             | Yes               |
| `IN_FLIGHT` | Submitted to wallet/RPC, awaiting confirmation | Yes               |
| `COMPLETED` | Transaction confirmed on-chain                 | No (terminal)     |
| `FAILED`    | Terminal failure (will not retry)              | No (terminal)     |
| `UNKNOWN`   | Outcome unknown (timeout, wallet closed)       | Yes (recoverable) |

## Usage

### Basic Example

```typescript
import { getIdempotencyService } from "@/services/idempotency-transaction-handling";
import { StorageStrategy } from "@/types/idempotency";

// Initialize service with session storage (persists across page reloads)
const service = getIdempotencyService({
  strategy: StorageStrategy.SESSION,
  ttl: 30 * 60 * 1000, // 30 minutes
});

// Generate a unique key for this operation
const key = service.generateKey({
  operation: "coinFlip",
  userContext: "wallet:GABC...",
});

// Check for duplicate before proceeding
const duplicate = service.checkDuplicate(key);

if (!duplicate.isDuplicate) {
  // Register the request
  service.registerRequest(key, "coinFlip", { gameId: "game_123" });

  // Update state as transaction progresses
  service.updateState(key, "IN_FLIGHT");

  try {
    // Execute transaction
    const result = await submitTransaction();

    // Mark as completed
    service.updateState(key, "COMPLETED", {
      txHash: result.hash,
      ledger: result.ledger,
    });
  } catch (error) {
    // Mark as failed
    service.updateState(key, "FAILED", { error });
  }
} else {
  // Handle duplicate - return cached result or show error
  console.log("Duplicate request detected:", duplicate.reason);
}
```

### Integration with Backend Idempotency

When making API calls that require idempotency (wallet operations, game plays):

```typescript
import {
  getIdempotencyService,
  StorageStrategy,
} from "@/services/idempotency-transaction-handling";

const idempotencyService = getIdempotencyService({
  strategy: StorageStrategy.SESSION,
});

async function makeWithdrawal(amount: number, address: string) {
  // Generate idempotency key
  const idempotencyKey = idempotencyService.generateKey({
    operation: "withdraw",
    userContext: address,
  });

  // Register request
  idempotencyService.registerRequest(idempotencyKey, "withdraw", {
    amount,
    address,
  });

  try {
    // Make API call with idempotency key
    const response = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey, // Critical for backend idempotency
      },
      body: JSON.stringify({ amount, address }),
    });

    if (response.ok) {
      const result = await response.json();
      idempotencyService.updateState(idempotencyKey, "COMPLETED");
      return result;
    } else if (response.status === 409) {
      // Idempotency conflict - key reused with different body
      idempotencyService.updateState(idempotencyKey, "FAILED", {
        error: { message: "Idempotency key conflict" },
      });
      throw new Error(
        "Idempotency conflict: key already used with different data",
      );
    } else {
      throw new Error(`Request failed: ${response.status}`);
    }
  } catch (error) {
    // Network error or timeout - safe to retry with SAME key
    idempotencyService.updateState(idempotencyKey, "UNKNOWN");
    throw error; // Caller can decide to retry
  }
}
```

### Retry Strategy

```typescript
async function retryWithIdempotency<T>(
  operation: string,
  apiCall: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const idempotencyKey = idempotencyService.generateKey({ operation });
  idempotencyService.registerRequest(idempotencyKey, operation);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      idempotencyService.updateState(idempotencyKey, "COMPLETED");
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        idempotencyService.updateState(idempotencyKey, "FAILED", { error });
        throw error;
      }

      // Update state to UNKNOWN for recovery
      idempotencyService.updateState(idempotencyKey, "UNKNOWN");

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### Recovery from Unknown State

```typescript
async function recoverUnknownTransaction(idempotencyKey: string) {
  const request = idempotencyService.getRequest(idempotencyKey);

  if (request?.state !== "UNKNOWN") {
    return; // Nothing to recover
  }

  if (!request.txHash) {
    // Cannot recover without transaction hash
    idempotencyService.updateState(idempotencyKey, "FAILED", {
      error: { message: "Cannot recover: no transaction hash" },
    });
    return;
  }

  // Poll Stellar RPC to check transaction status
  const txStatus = await stellarRpc.getTransaction(request.txHash);

  if (txStatus.success) {
    idempotencyService.updateState(idempotencyKey, "COMPLETED", {
      txHash: request.txHash,
      ledger: txStatus.ledger,
    });
  } else if (txStatus.failed) {
    idempotencyService.updateState(idempotencyKey, "FAILED", {
      error: { message: "Transaction failed on-chain" },
    });
  }
}
```

## Storage Strategies

| Strategy  | Persistence              | Use Case                                       |
| --------- | ------------------------ | ---------------------------------------------- |
| `MEMORY`  | Lost on page reload      | Short-lived operations, testing                |
| `SESSION` | Lost on tab/window close | **Recommended** for most transactions          |
| `LOCAL`   | Persists across sessions | Long-running operations, critical transactions |

### Configuring Storage

```typescript
// Session storage (default, recommended)
const sessionService = getIdempotencyService({
  strategy: StorageStrategy.SESSION,
  ttl: 30 * 60 * 1000, // 30 minutes
});

// Local storage for critical operations
const localStorageService = getIdempotencyService({
  strategy: StorageStrategy.LOCAL,
  ttl: 60 * 60 * 1000, // 1 hour
  keyPrefix: "stellarcade_critical",
});
```

## API Reference

### `generateKey(params: IdempotencyKeyParams): IdempotencyKey`

Generates a unique idempotency key for an operation.

**Parameters:**

- `operation` (string): Operation identifier (e.g., 'coinFlip', 'withdraw')
- `userContext` (string, optional): User-provided context (e.g., wallet address)
- `timestamp` (number, optional): Override timestamp (defaults to `Date.now()`)

**Returns:** `string` - Format: `{operation}_{timestamp}_{randomId}`

### `checkDuplicate(key: IdempotencyKey): DuplicateCheckResult`

Checks if a key represents an active duplicate submission.

**Returns:**

- `isDuplicate: boolean` - True if active duplicate found
- `existingRequest?: IdempotencyRequest` - The existing request if found
- `reason?: string` - Reason for duplicate detection

### `registerRequest(key, operation, context): IdempotencyRequest`

Registers a new idempotent request in PENDING state.

### `updateState(key, state, metadata): IdempotencyRequest`

Updates request state with optional metadata (txHash, ledger, error).

**Valid State Transitions:**

- `PENDING` → `IN_FLIGHT` or `FAILED`
- `IN_FLIGHT` → `COMPLETED`, `FAILED`, or `UNKNOWN`
- `UNKNOWN` → `COMPLETED` or `FAILED`
- `COMPLETED` → (terminal, no transitions)
- `FAILED` → (terminal, no transitions)

### `recoverRequest(options: RecoveryOptions): Promise<RecoveryResult>`

Attempts to recover a transaction with UNKNOWN outcome.

## Best Practices

### Do's

1. **Generate keys client-side** using the service's `generateKey()` method
2. **Use session storage** for most transactions (survives page reload, cleared on close)
3. **Check for duplicates** before submitting new requests
4. **Update state progressively** as the transaction lifecycle advances
5. **Handle 409 errors** from backend as programming errors (key reuse with different data)
6. **Retry with the same key** when network errors occur

### Don'ts

1. **Don't reuse keys** across different operations
2. **Don't generate keys server-side** (loses client-side tracking benefits)
3. **Don't skip duplicate checks** before submission
4. **Don't use local storage** unless the operation is critical and long-running
5. **Don't ignore UNKNOWN states** - implement recovery logic

## Error Handling

### Idempotency Conflict (409)

```typescript
if (response.status === 409) {
  // This indicates a bug: key was reused with different request body
  // Log the error and generate a new key for the operation
  console.error("Idempotency conflict - key reuse detected");
  idempotencyService.updateState(key, "FAILED", {
    error: { message: "Idempotency key conflict" },
  });
}
```

### Network Timeout

```typescript
try {
  const result = await apiCall();
  // Success
} catch (error) {
  if (error.name === "TimeoutError") {
    // Mark as UNKNOWN - outcome is uncertain
    idempotencyService.updateState(key, "UNKNOWN");
    // Can safely retry with same key
  }
}
```

## Testing

```typescript
import {
  IdempotencyTransactionHandler,
  StorageStrategy,
} from "@/services/idempotency-transaction-handling";

describe("IdempotencyService", () => {
  let service;

  beforeEach(() => {
    service = new IdempotencyTransactionHandler({
      strategy: StorageStrategy.MEMORY,
    });
  });

  it("generates unique keys", () => {
    const key1 = service.generateKey({ operation: "test" });
    const key2 = service.generateKey({ operation: "test" });
    expect(key1).not.toBe(key2);
  });

  it("detects duplicates", () => {
    const key = service.generateKey({ operation: "test" });
    service.registerRequest(key, "test");

    const result = service.checkDuplicate(key);
    expect(result.isDuplicate).toBe(true);
  });

  it("validates state transitions", () => {
    const key = service.generateKey({ operation: "test" });
    service.registerRequest(key, "test");

    // Valid: PENDING -> IN_FLIGHT
    service.updateState(key, "IN_FLIGHT");

    // Invalid: IN_FLIGHT -> PENDING
    expect(() => service.updateState(key, "PENDING")).toThrow();
  });
});
```

## Related Documentation

- [Backend Idempotency Middleware](../../backend/src/middleware/idempotency.middleware.js)
- [API Idempotency Guide](../../docs/API_DOCUMENTATION.md#idempotency)
- [Idempotency Types](../types/idempotency.ts)
