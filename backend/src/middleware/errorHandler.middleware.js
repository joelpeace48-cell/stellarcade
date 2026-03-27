/**
 * Centralized error handling middleware.
 */
const logger = require('../utils/logger');
const correlationStore = require('../utils/correlation-store');

const isBodySizeLimitError = (err) => {
  return err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413;
};

const isNetworkMismatchError = (err) => {
  return err?.code === 'NETWORK_MISMATCH' || err?.name === 'NetworkMismatchError';
};

const errorHandlerMiddleware = (err, req, res, _next) => {
  logger.error(`${err.name || 'Error'}: ${err.message}`, { stack: err.stack });

  if (isBodySizeLimitError(err)) {
    return res.status(413).json({
      error: {
        message: 'Request payload exceeds the allowed size limit.',
        code: 'PAYLOAD_TOO_LARGE',
        status: 413,
        correlationId: req.correlationId || correlationStore.getStore()?.correlationId,
      },
    });
  }

  if (isNetworkMismatchError(err)) {
    return res.status(400).json({
      error: {
        message: err.message || 'Wallet network does not match the configured backend network.',
        code: 'NETWORK_MISMATCH',
        status: 400,
        expectedNetwork: err.expectedNetwork,
        receivedNetwork: err.receivedNetwork,
        correlationId: req.correlationId || correlationStore.getStore()?.correlationId,
      },
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      status: statusCode,
      correlationId: req.correlationId || correlationStore.getStore()?.correlationId,
    },
  });
};

module.exports = errorHandlerMiddleware;
