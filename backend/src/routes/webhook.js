const express = require('express');
const webhookSignature = require('../middleware/webhook-signature.middleware');

const router = express.Router();

router.post('/', webhookSignature, (req, res) => {
  res.status(200).json({
    received: true,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
