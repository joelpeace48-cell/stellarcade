/**
 * Stellar Network Transaction Service
 *
 * Core service for submitting and monitoring transactions on the Stellar network.
 * This service is the primary interface between the backend and all Soroban smart contracts.
 *
 * ## Contract Interactions
 * This service interacts with ALL smart contracts in the Stellarcade ecosystem:
 *
 * ### Core Infrastructure Contracts
 * - `prize-pool`: Fund deposits, prize reservations, payouts
 * - `treasury`: Treasury deposits, allocations, releases
 * - `random-generator`: Randomness requests, result retrieval
 * - `access-control`: Admin role management
 * - `contract-address-registry`: Contract address lookups
 *
 * ### Game Contracts
 * - `coin-flip`: Place bets, resolve games
 * - `daily-trivia`: Start games, submit answers
 * - `speed-trivia`: Fast-paced trivia games
 * - `dice-roll`: Roll dice, get results
 * - `number-guess`: Submit guesses, resolve games
 * - `pattern-puzzle`: Submit patterns, verify solutions
 * - `wordle-clone`: Start games, submit guesses
 * - `color-prediction`: Submit predictions, get results
 * - `higher-lower`: Submit guesses, resolve games
 * - `price-prediction`: Submit predictions, settle outcomes
 *
 * ### Platform Feature Contracts
 * - `leaderboard`: Score updates, rank queries
 * - `staking`: Stake tokens, claim rewards
 * - `governance`: Create proposals, vote
 * - `referral-system`: Register referrals, claim rewards
 * - `tournament-system`: Create tournaments, join, settle
 * - `matchmaking-queue`: Join/leave queues, match players
 * - `multiplayer-room`: Create rooms, join, manage state
 *
 * ### Cross-Contract & Utility Contracts
 * - `cross-chain-bridge`: Bridge assets between chains
 * - `cross-contract-handler`: Coordinate multi-contract calls
 * - `oracle-integration`: Request oracle data
 * - `session-nonce-manager`: Generate/validate session nonces
 * - `contract-upgrade-timelock`: Schedule and execute upgrades
 *
 * ## Transaction Flow
 *
 * 1. Service receives base64-encoded TransactionEnvelope XDR
 * 2. Deserializes and validates XDR structure
 * 3. Submits transaction to configured Horizon/Soroban RPC endpoint
 * 4. Parses response or error from network
 * 5. Returns structured result with hash, ledger, success status
 *
 * ## Error Handling
 *
 * All errors are parsed into structured format with:
 * - `code`: Machine-readable error code (e.g., 'TX_FAILED', 'TIMEOUT')
 * - `message`: Human-readable error description
 * - `resultCodes`: Detailed Horizon result codes (if available)
 * - `httpStatus`: HTTP status code from Horizon (if applicable)
 *
 * ## Fail-Open Design
 *
 * In case of network errors or Horizon unavailability, the service
 * returns structured error responses instead of throwing exceptions.
 * This allows callers to implement retry logic with proper backoff.
 *
 * @see {@link ../../docs/ARCHITECTURE.md#backend-contract-interaction-matrix} for full interaction matrix
 * @see {@link ../../docs/contracts/README.md} for contract reference
 *
 * @example
 * // Submit a transaction to the prize-pool contract
 * const stellarService = require('./stellar.service');
 *
 * const result = await stellarService.submitTransaction(transactionXDR);
 *
 * if (result.status === 'success') {
 *   console.log(`Transaction successful: ${result.hash}`);
 * } else {
 *   console.error(`Transaction failed: ${result.errorMessage}`);
 *   // Implement retry logic with backoff
 * }
 */
const StellarSdk = require('@stellar/stellar-sdk');
const logger = require('../utils/logger');
const { server, passphrase } = require('../config/stellar');
const Outbox = require('../models/Outbox.model');

class NetworkMismatchError extends Error {
  constructor({ expectedNetwork, receivedNetwork }) {
    super(
      `Wallet network mismatch: expected ${expectedNetwork}, received ${receivedNetwork}. Please switch your wallet network and try again.`
    );
    this.name = 'NetworkMismatchError';
    this.code = 'NETWORK_MISMATCH';
    this.statusCode = 400;
    this.expectedNetwork = expectedNetwork;
    this.receivedNetwork = receivedNetwork;
  }
}

/**
 * Error codes returned in the service result for structured error handling by callers.
 */
const STELLAR_ERRORS = {
  INVALID_XDR: 'INVALID_XDR',
  TX_FAILED: 'TX_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
};

/**
 * Parse a Horizon error response into a structured object.
 * Horizon wraps submission failures inside response.data.extras.result_codes.
 *
 * @param {import('@stellar/stellar-sdk').NetworkError} err
 * @returns {{ code: string, message: string, resultCodes: object|null, httpStatus: number|null }}
 */
const parseHorizonError = (err) => {
  const response = err.response || {};
  const httpStatus = response.status || null;
  const data = response.data || {};
  const resultCodes = data.extras?.result_codes || null;

  // 408 / ECONNABORTED / ERR_CANCELED → timeout
  if (
    httpStatus === 408 ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ERR_CANCELED' ||
    /timeout/i.test(err.message || '')
  ) {
    return { code: STELLAR_ERRORS.TIMEOUT, message: 'Request timed out', resultCodes, httpStatus };
  }

  // 429 → rate limited
  if (httpStatus === 429) {
    return {
      code: STELLAR_ERRORS.RATE_LIMITED,
      message: 'Horizon rate limit exceeded',
      resultCodes,
      httpStatus,
    };
  }

  // 400 with result_codes → transaction was submitted but failed on-chain
  if (httpStatus === 400 && resultCodes) {
    return {
      code: STELLAR_ERRORS.TX_FAILED,
      message: data.title || 'Transaction failed',
      resultCodes,
      httpStatus,
    };
  }

  // 5xx → Horizon server error
  if (httpStatus >= 500) {
    return {
      code: STELLAR_ERRORS.SERVER_ERROR,
      message: data.title || `Horizon server error (${httpStatus})`,
      resultCodes,
      httpStatus,
    };
  }

  // fallback
  return {
    code: STELLAR_ERRORS.NETWORK_ERROR,
    message: err.message || 'Unknown network error',
    resultCodes,
    httpStatus,
  };
};

/**
 * Submit a base64-encoded Stellar transaction XDR to the configured Horizon endpoint.
 *
 * @param {string} transactionXDR - Base64-encoded TransactionEnvelope XDR string.
 * @returns {Promise<{
 *   status: 'success'|'error',
 *   hash: string|null,
 *   ledger: number|null,
 *   successful: boolean,
 *   envelopeXDR: string|null,
 *   resultXDR: string|null,
 *   errorCode: string|null,
 *   errorMessage: string|null,
 *   resultCodes: object|null,
 * }>}
 */
const submitTransaction = async (transactionXDR) => {
  // --- 1. Deserialise and validate XDR ---
  let transaction;
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, passphrase);
  } catch (parseErr) {
    logger.warn('Invalid transaction XDR supplied:', parseErr.message);
    return {
      status: 'error',
      hash: null,
      ledger: null,
      successful: false,
      envelopeXDR: null,
      resultXDR: null,
      errorCode: STELLAR_ERRORS.INVALID_XDR,
      errorMessage: `Invalid XDR: ${parseErr.message}`,
      resultCodes: null,
    };
  }

  // --- 2. Submit to Horizon ---
  logger.info('Submitting transaction to Stellar network...');
  try {
    const response = await server.submitTransaction(transaction);

    logger.info(
      `Transaction submitted successfully. hash=${response.hash} ledger=${response.ledger}`
    );

    return {
      status: 'success',
      hash: response.hash,
      ledger: response.ledger,
      successful: response.successful,
      envelopeXDR: response.envelope_xdr,
      resultXDR: response.result_xdr,
      errorCode: null,
      errorMessage: null,
      resultCodes: null,
    };
  } catch (err) {
    const parsed = parseHorizonError(err);

    logger.error(
      `Transaction submission failed. code=${parsed.code} httpStatus=${parsed.httpStatus} message=${parsed.message}`,
      { resultCodes: parsed.resultCodes }
    );

    return {
      status: 'error',
      hash: null,
      ledger: null,
      successful: false,
      envelopeXDR: null,
      resultXDR: null,
      errorCode: parsed.code,
      errorMessage: parsed.message,
      resultCodes: parsed.resultCodes,
    };
  }
};

/**
 * Add a transaction to the outbox for deferred processing.
 * This provides idempotent retry semantics and observability.
 *
 * @param {string} transactionXDR - Base64-encoded TransactionEnvelope XDR string.
 * @returns {Promise<{
 *   status: 'queued'|'error',
 *   outboxId: string|null,
 *   errorCode: string|null,
 *   errorMessage: string|null,
 * }>}
 */
const submitTransactionAsync = async (transactionXDR) => {
  // Validate XDR before adding to outbox
  let _transaction;
  try {
    _transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, passphrase);
  } catch (parseErr) {
    logger.warn('Invalid transaction XDR supplied for async submission:', parseErr.message);
    return {
      status: 'error',
      outboxId: null,
      errorCode: STELLAR_ERRORS.INVALID_XDR,
      errorMessage: `Invalid XDR: ${parseErr.message}`,
    };
  }

  try {
    const outbox = await Outbox.create({
      transaction_xdr: transactionXDR,
    });

    logger.info(`Transaction queued for deferred processing. outboxId=${outbox.id}`);

    return {
      status: 'queued',
      outboxId: outbox.id,
      errorCode: null,
      errorMessage: null,
    };
  } catch (err) {
    logger.error('Failed to queue transaction for deferred processing:', err);
    return {
      status: 'error',
      outboxId: null,
      errorCode: 'OUTBOX_ERROR',
      errorMessage: `Failed to queue transaction: ${err.message}`,
    };
  }
};

const normalizeNetworkName = (networkName) => {
  return String(networkName || '').trim().toLowerCase();
};

const assertWalletNetwork = ({ walletNetwork, expectedNetwork }) => {
  const normalizedWalletNetwork = normalizeNetworkName(walletNetwork);
  const normalizedExpectedNetwork = normalizeNetworkName(expectedNetwork);

  if (!normalizedWalletNetwork || normalizedWalletNetwork !== normalizedExpectedNetwork) {
    throw new NetworkMismatchError({
      expectedNetwork: normalizedExpectedNetwork || 'unknown',
      receivedNetwork: normalizedWalletNetwork || 'unknown',
    });
  }
};

module.exports = {
  submitTransaction,
  submitTransactionAsync,
  assertWalletNetwork,
  STELLAR_ERRORS,
  NetworkMismatchError,
  // exported for testing only
  _parseHorizonError: parseHorizonError,
};
