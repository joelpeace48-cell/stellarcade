# API Documentation

The Stellarcade backend provides a RESTful API for interacting with games, users, wallets, and service health endpoints.

## Authentication

Most endpoints require a JWT token in the `Authorization` header.

```text
Authorization: Bearer <your_token>
```

## Idempotency

The API supports idempotent requests to prevent duplicate operations when retrying failed requests. This is **required** for wallet and financial operations, and **optional** for game plays.

### How It Works

1. **Client generates a unique idempotency key** (UUID or similar) for each operation
2. **Include the key in the `Idempotency-Key` header** with your request
3. **Server caches successful responses** for 24 hours
4. **Duplicate requests with the same key** return the cached response instead of re-executing

### When to Use Idempotency

| Endpoint Type               | Idempotency    | Reason                                    |
| --------------------------- | -------------- | ----------------------------------------- |
| `POST /api/wallet/deposit`  | **Required**   | Prevents duplicate deposits               |
| `POST /api/wallet/withdraw` | **Required**   | Prevents duplicate withdrawals            |
| `POST /api/games/play`      | Optional       | Prevents accidental double-plays          |
| `GET` endpoints             | Not applicable | Read operations are inherently idempotent |

### Header Contract

```http
Idempotency-Key: <unique-key-per-operation>
```

**Key Requirements:**

- Must be unique per distinct operation
- Recommended format: UUID v4 or similar (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Maximum length: 256 characters
- Allowed characters: alphanumeric, hyphens, underscores
- **Reuse with same body**: Returns cached response (idempotent replay)
- **Reuse with different body**: Returns `409 Conflict` (key collision detected)

### Client Behavior

```javascript
// Example: Making an idempotent withdrawal request
const makeWithdrawal = async (amount, address) => {
  // Generate a unique key for this specific operation
  const idempotencyKey = crypto.randomUUID();

  try {
    const response = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ amount, address }),
    });

    if (response.status === 409) {
      // Key was reused with different request body
      console.error(
        "Idempotency conflict - key already used with different data",
      );
      return;
    }

    return await response.json();
  } catch (error) {
    // Safe to retry with the SAME idempotency key
    // Server will return cached response if original succeeded
    console.log("Retrying with same idempotency key...");
  }
};
```

### Retry Strategy

When a request fails (network error, timeout, 5xx), **retry with the same idempotency key**:

```javascript
const retryWithIdempotency = async (endpoint, body, maxRetries = 3) => {
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey, // Same key for all retries
        },
        body: JSON.stringify(body),
      });

      // Success - return the result (may be from cache)
      if (response.ok) return await response.json();

      // Client error - don't retry
      throw new Error(`Request failed: ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Wait before retry (exponential backoff recommended)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

### Response Behavior

| Scenario                             | Server Response                                           |
| ------------------------------------ | --------------------------------------------------------- |
| First request with key               | Executes operation, caches response (2xx), returns result |
| Retry with same key + same body      | Returns cached response with `200 OK`                     |
| Retry with same key + different body | Returns `409 Conflict` with error message                 |
| Request without key (mutation)       | Executes normally (no idempotency guarantee)              |

### Example 409 Conflict Response

```json
{
  "error": "Idempotency Conflict",
  "message": "The provided Idempotency-Key was already used with a different request payload."
}
```

### Caching Details

- **Cache duration**: 24 hours from first successful response
- **Cache key**: `idempotency:{userId}:{clientKey}` (scoped to user)
- **Cached data**: Request body hash, status code, response body
- **Only 2xx responses** are cached

### Frontend Integration

The frontend provides a built-in service for managing idempotency in transaction flows. See [Idempotency Transaction Handling](../frontend/src/services/idempotency-transaction-handling.README.md) for implementation details.

### Best Practices

1. **Generate keys client-side** using a reliable UUID generator
2. **Store keys temporarily** during request lifecycle for retry scenarios
3. **Use one key per logical operation** - don't reuse across different operations
4. **Handle 409 errors** gracefully - they indicate a programming error (key reuse)
5. **Don't use idempotency for read operations** - GET requests skip idempotency checks

## Endpoints

### Games

- **GET** `/api/games` - Retrieve a list of available games.
- **GET** `/api/games/:id` - Get details of a specific game.
- **POST** `/api/games/play` - Initiate a game play request.
  - Body: `{ "gameType": "coin-flip", "betAmount": "10", "choice": "heads" }`

### Users

- **GET** `/api/users/profile` - Get the current user's profile.
- **POST** `/api/users/create` - Create a new user account linked to a Stellar address.
- **GET** `/api/users/balance` - Get the user's on-platform balance.

### Wallet

- **POST** `/api/wallet/deposit` - Get instructions for depositing Stellar assets.
- **POST** `/api/wallet/withdraw` - Withdraw assets to a Stellar address.
- **GET** `/api/wallet/transactions` - List all deposit and withdrawal transactions.

### Health

- **GET** `/api/health` - Check the status of the API service.
- **GET** `/api/health/deep` - Run deep dependency diagnostics for PostgreSQL, Redis, and Stellar Horizon.

The deep health response includes a top-level `status`, an ISO-8601 `timestamp`, and a `dependencies` object keyed by `db`, `redis`, and `stellar`.

Each dependency entry always includes:

- `status` - `healthy` or `unhealthy`
- `latency_ms` - observed latency for the dependency probe
- `timeout_ms` - timeout budget applied to that probe
- `timed_out` - `true` when the probe exceeded its timeout budget

Unhealthy dependency entries also include:

- `failure_type` - stable failure category for dashboards and alerts
- `error` - compact diagnostic message from the failed probe

Example deep health response:

```json
{
  "status": "degraded",
  "timestamp": "2026-03-25T12:00:00.000Z",
  "dependencies": {
    "db": {
      "status": "healthy",
      "latency_ms": 4,
      "timeout_ms": 5000,
      "timed_out": false
    },
    "redis": {
      "status": "unhealthy",
      "latency_ms": 5001,
      "timeout_ms": 5000,
      "timed_out": true,
      "failure_type": "timeout",
      "error": "redis check timed out after 5000ms"
    },
    "stellar": {
      "status": "healthy",
      "latency_ms": 12,
      "timeout_ms": 5000,
      "timed_out": false
    }
  }
}
```

## Error Codes

- `400 Bad Request`: Invalid input parameters.
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Insufficient permissions or balance.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unexpected server error.

## Rate Limiting

- Default limit: 60 requests per minute per IP.
- Authenticated limit: 200 requests per minute per user.
