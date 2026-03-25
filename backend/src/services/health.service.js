const db = require('../config/database');
const { client: redisClient } = require('../config/redis');
const { server: horizonServer } = require('../config/stellar');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = 5000;
const HEALTH_TIMEOUT_ERROR_CODE = 'HEALTH_CHECK_TIMEOUT';
const GENERIC_FAILURE_TYPE = 'dependency_error';

const getElapsedMs = (startNs) => Number((process.hrtime.bigint() - startNs) / BigInt(1e6));

const createTimeoutError = (name, timeoutMs) => {
  const error = new Error(`${name} check timed out after ${timeoutMs}ms`);
  error.code = HEALTH_TIMEOUT_ERROR_CODE;
  return error;
};

const getFailureType = (error) =>
  error && error.code === HEALTH_TIMEOUT_ERROR_CODE ? 'timeout' : GENERIC_FAILURE_TYPE;

/**
 * Measure latency of an async check, returning stable status and latency fields.
 *
 * @param {string} name - dependency label (for logging)
 * @param {Function} checkFn - async function that performs the check
 * @param {number} timeoutMs - max time before the check is considered failed
 * @returns {Promise<{status: string, latency_ms: number, timeout_ms: number, timed_out: boolean, failure_type?: string, error?: string}>}
 */
const timedCheck = async (name, checkFn, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const startNs = process.hrtime.bigint();
  let timeoutId;

  try {
    await Promise.race([
      checkFn(),
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(name, timeoutMs)), timeoutMs);
      }),
    ]);

    return {
      status: 'healthy',
      latency_ms: getElapsedMs(startNs),
      timeout_ms: timeoutMs,
      timed_out: false,
    };
  } catch (err) {
    logger.warn(`Health check failed for ${name}: ${err.message}`);

    return {
      status: 'unhealthy',
      latency_ms: getElapsedMs(startNs),
      timeout_ms: timeoutMs,
      timed_out: err.code === HEALTH_TIMEOUT_ERROR_CODE,
      failure_type: getFailureType(err),
      error: err.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Check PostgreSQL connectivity by running a trivial query.
 */
const checkDatabase = (timeoutMs) => {
  return timedCheck(
    'db',
    async () => {
      await db.raw('SELECT 1');
    },
    timeoutMs
  );
};

/**
 * Check Redis connectivity via PING.
 */
const checkRedis = (timeoutMs) => {
  return timedCheck(
    'redis',
    async () => {
      const reply = await redisClient.ping();
      if (reply !== 'PONG') {
        throw new Error(`Unexpected PING reply: ${reply}`);
      }
    },
    timeoutMs
  );
};

/**
 * Check Stellar Horizon connectivity by fetching the root endpoint.
 */
const checkStellar = (timeoutMs) => {
  return timedCheck(
    'stellar',
    async () => {
      await horizonServer.root();
    },
    timeoutMs
  );
};

/**
 * Run all dependency health checks in parallel and return an aggregate result.
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - per-check timeout in milliseconds
 * @returns {Promise<{status: string, timestamp: string, dependencies: Object}>}
 */
const deepHealthCheck = async (options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const [dbResult, redisResult, stellarResult] = await Promise.all([
    checkDatabase(timeoutMs),
    checkRedis(timeoutMs),
    checkStellar(timeoutMs),
  ]);

  const dependencies = {
    db: dbResult,
    redis: redisResult,
    stellar: stellarResult,
  };

  const statuses = Object.values(dependencies).map((d) => d.status);
  const allHealthy = statuses.every((s) => s === 'healthy');
  const allUnhealthy = statuses.every((s) => s === 'unhealthy');

  let status;
  if (allHealthy) {
    status = 'healthy';
  } else if (allUnhealthy) {
    status = 'unhealthy';
  } else {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    dependencies,
  };
};

module.exports = {
  deepHealthCheck,
  checkDatabase,
  checkRedis,
  checkStellar,
};
