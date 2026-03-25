/**
 * Controller for deep health diagnostics endpoint.
 */
const healthService = require('../services/health.service');

const getDeepHealth = async (req, res, next) => {
  try {
    const result = await healthService.deepHealthCheck();
    const httpStatus = result.status === 'healthy' ? 200 : 503;
    res.set('Cache-Control', 'no-store');
    res.status(httpStatus).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeepHealth,
};
