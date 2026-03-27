const crypto = require('crypto');
const { client } = require('../config/redis');
const audit = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * Idempotency Middleware for Stellarcade API
 *
 * Enforces idempotent behavior on mutation requests by caching and replaying
 * successful responses based on a client-provided Idempotency-Key header.
 *
 * ## How It Works
 * 1. Client generates a unique key (UUID recommended) per operation
 * 2. Middleware hashes the request body and stores it with the key in Redis
 * 3. On duplicate key, verifies body hash matches original
 * 4. If match: replays cached response (idempotent)
 * 5. If mismatch: returns 409 Conflict (key reuse detected)
 *
 * ## Redis Key Schema
 * `idempotency:{userId}:{clientKey}`
 *
 * ## Cache Behavior
 * - Only caches 2xx (successful) responses
 * - Cache TTL: 24 hours
 * - Scoped to user ID (from req.user after auth middleware)
 *
 * ## When to Use
 * - REQUIRED: Wallet operations (deposit, withdraw)
 * - OPTIONAL: Game plays (prevents accidental double-plays)
 * - NOT USED: GET/HEAD/OPTIONS (inherently idempotent)
 *
 * @example
 * // Client usage example
 * fetch('/api/wallet/withdraw', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': 'Bearer <token>',
 *     'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000'
 *   },
 *   body: JSON.stringify({ amount: 100, address: 'G...' })
 * });
 *
 * @see {@link ../../docs/API_DOCUMENTATION.md#idempotency} for full API documentation
 * @see {@link ../../frontend/src/services/idempotency-transaction-handling.README.md} for frontend integration
 */
const stableStringify = (value) => JSON.stringify(audit.normalizeValue(value));

const buildFingerprint = (req) =>
  crypto
    .createHash('sha256')
    .update(
      stableStringify({
        method: req.method,
        path: req.originalUrl || req.path,
        body: req.body || {},
      })
    )
    .digest('hex');

const duplicateMetadata = (req, key, fingerprint, extra = {}) => ({
  idempotencyKey: key,
  fingerprint,
  method: req.method,
  path: req.originalUrl || req.path,
  userId: req.user ? String(req.user.id) : 'anonymous',
  request: audit.redactSensitive(req.body || {}),
  ...extra,
});

const idempotency = async (req, res, next) => {
  const key = req.header('Idempotency-Key');

  // Skip if no idempotency key or if it's not a mutation/side-effect method.
  // GET, HEAD, OPTIONS are inherently idempotent and don't need caching
  if (!key || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Redis Key Schema: idempotency:{userId}:{clientKey}
  // Scoped to user to prevent cross-user key collisions
  const userId = req.user ? req.user.id : 'anonymous';
  const redisKey = `idempotency:${userId}:${key}`;
  const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours

  try {
    const cachedResponse = await client.get(redisKey);
    const fingerprint = buildFingerprint(req);

    if (cachedResponse) {
      const { requestHash, requestFingerprint, statusCode, body } = JSON.parse(cachedResponse);
      const cachedFingerprint = requestFingerprint || requestHash;

      // Verify that the request body matches the one used for the original request.
      // If hashes differ, the client is reusing a key with different data → reject with 409
      if (cachedFingerprint !== fingerprint) {
        audit.log({
          actor: userId,
          action: 'idempotency.conflict',
          target: redisKey,
          payload: { idempotencyKey: key, fingerprint },
          outcome: 'failure',
          metadata: duplicateMetadata(req, key, fingerprint, {
            cachedFingerprint,
            replayed: false,
          }),
        });
        return res.status(409).json({
          error: 'Idempotency Conflict',
          message:
            'The provided Idempotency-Key was already used with a different request payload.',
        });
      }

      logger.info(`[Idempotency] Replaying cached response for key: ${key}`);
      audit.log({
        actor: userId,
        action: 'idempotency.replay',
        target: redisKey,
        payload: { idempotencyKey: key, fingerprint },
        outcome: 'success',
        metadata: duplicateMetadata(req, key, fingerprint, {
          cachedStatusCode: statusCode,
          replayed: true,
        }),
      });
      return res.status(statusCode).json(body);
    }

    /**
     * Intercept response to store successful results.
     * We override res.json to capture the data before it's sent.
     *
     * Only 2xx responses are cached. Errors (4xx, 5xx) are not cached
     * to allow clients to retry failed requests.
     */
    const originalJson = res.json;
    res.json = function (data) {
      // Only cache successful mutations (200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payloadToCache = {
          requestHash: fingerprint,
          requestFingerprint: fingerprint,
          statusCode: res.statusCode,
          body: data,
        };

        // Store in Redis with TTL; errors are logged but don't block response
        client.setEx(redisKey, IDEMPOTENCY_TTL, JSON.stringify(payloadToCache)).catch((err) => {
          logger.error('[Idempotency] Failed to store result in Redis:', err);
        });
      }

      // Restore original res.json behavior
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    logger.error('[Idempotency] Middleware internal error:', error);
    // In case of Redis failure, we proceed with the request to avoid blocking users
    // This is a fail-open design: better to allow duplicates than block legitimate requests
    next();
  }
};

module.exports = idempotency;
