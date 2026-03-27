/**
 * Controller for managing user-specific operations.
 */
const logger = require('../utils/logger');
const _User = require('../models/User.model');
const audit = require('../services/audit.service');

const ALLOWED_AUDIT_ACTIONS = ['wallet.deposit', 'wallet.withdraw', 'game.play'];

const getAuditLogs = async (req, res, next) => {
  try {
    const { actor, action } = req.query;
    const limit = req.query.limit === undefined ? 50 : parseInt(req.query.limit, 10);

    if (req.query.limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
      const error = new Error('Query parameter "limit" must be a positive integer.');
      error.statusCode = 400;
      error.code = 'INVALID_QUERY_PARAM';
      throw error;
    }

    if (action && !ALLOWED_AUDIT_ACTIONS.includes(action)) {
      const error = new Error('Query parameter "action" has an unsupported value.');
      error.statusCode = 400;
      error.code = 'INVALID_QUERY_PARAM';
      throw error;
    }

    const entries = await audit.list({ actor, action, limit });
    res.status(200).json({ items: entries });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    // TODO: Fetch profile logic
    res.status(200).json({ id, username: 'player' });
  } catch (error) {
    next(error);
  }
};

const createProfile = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    logger.info(`Creating profile for wallet: ${walletAddress}`);
    // TODO: Persistence logic
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  createProfile,
  getAuditLogs,
};
