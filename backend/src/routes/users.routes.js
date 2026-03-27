const express = require('express');
const { getProfile, createProfile, getAuditLogs } = require('../controllers/users.controller');
const auth = require('../middleware/auth.middleware');
const { rateLimit } = require('../middleware/rate-limit.middleware');

const router = express.Router();

const routeDocs = [
  {
    method: 'get',
    path: '/profile',
    operationId: 'getUserProfile',
    summary: 'Fetch the authenticated user profile',
    tags: ['Users'],
    responses: {
      200: {
        description: 'User profile fetched successfully',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserProfileResponse' },
          },
        },
      },
      401: {
        description: 'Authentication failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthErrorResponse' },
          },
        },
      },
      500: {
        description: 'Unexpected server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
          },
        },
      },
    },
  },
  {
    method: 'post',
    path: '/create',
    operationId: 'createUserProfile',
    summary: 'Create a new user profile',
    tags: ['Users'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateProfileRequest' },
        },
      },
    },
    responses: {
      201: {
        description: 'User profile created successfully',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateProfileResponse' },
          },
        },
      },
      500: {
        description: 'Unexpected server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
          },
        },
      },
    },
  },
];

router.get('/profile', auth, rateLimit('auth'), getProfile);
router.get('/audit-logs', auth, rateLimit('auth'), getAuditLogs);
router.post('/create', rateLimit('auth'), createProfile);

module.exports = router;
module.exports.routeDocs = routeDocs;
