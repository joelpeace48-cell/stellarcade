/**
 * Middleware for JWT authentication.
 */
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      code: 'AUTH_HEADER_MISSING',
      message: 'Authorization header is required',
    });
  }

  const [scheme, token] = authorization.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({
      code: 'AUTH_SCHEME_INVALID',
      message: 'Authorization header must use Bearer scheme',
    });
  }

  if (!token) {
    return res.status(401).json({
      code: 'AUTH_TOKEN_MISSING',
      message: 'Bearer token is missing',
    });
  }

  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not configured in environment');
    return res.status(500).json({ message: 'Internal server error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn(`Invalid JWT attempt from ${req.ip}`);
    return res.status(401).json({
      code: 'AUTH_TOKEN_INVALID',
      message: 'Invalid token',
    });
  }
};

module.exports = authMiddleware;
