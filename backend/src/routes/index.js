const express = require('express');
const gamesRoutes = require('./games.routes');
const usersRoutes = require('./users.routes');
const walletRoutes = require('./wallet.routes');
const webhookRoutes = require('./webhook');
const { getDeepHealth } = require('../controllers/health.controller');

const router = express.Router();

// Define V1 routes
// Default health check endpoint
const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'Operational',
    timestamp: new Date().toISOString(),
    service: 'stellarcade-api',
  });
};

// Define V1 routes
const v1Router = express.Router();
v1Router.get('/health', healthCheck);
v1Router.get('/health/deep', getDeepHealth);
v1Router.use('/games', gamesRoutes);
v1Router.use('/users', usersRoutes);
v1Router.use('/wallet', walletRoutes);
v1Router.use('/webhook', webhookRoutes);

// Mount V1 router under /v1
router.use('/v1', v1Router);

// Maintain backward compatibility for legacy /api/* routes
router.get('/health', healthCheck);
router.get('/health/deep', getDeepHealth);
router.use('/games', gamesRoutes);
router.use('/users', usersRoutes);
router.use('/wallet', walletRoutes);
router.use('/webhook', webhookRoutes);

module.exports = router;
