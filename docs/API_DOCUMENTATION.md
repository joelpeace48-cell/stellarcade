# API Documentation

The Stellarcade backend provides a RESTful API for interacting with games, users, wallets, and service health endpoints.

## Authentication

Most endpoints require a JWT token in the `Authorization` header.

```text
Authorization: Bearer <your_token>
```

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
