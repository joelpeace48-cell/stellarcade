const crypto = require('crypto');

const DEFAULT_TOLERANCE_SECONDS = 300;
const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const SIGNATURE_SCHEME = 'v1';

const seenSignatures = new Map();

const getToleranceMs = () => {
  const configured = Number(process.env.WEBHOOK_SIGNATURE_TOLERANCE_SEC);
  const seconds = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TOLERANCE_SECONDS;
  return seconds * 1000;
};

const parseSignatureHeader = (header) => {
  if (!header) return null;
  const parts = header.split(',').map((part) => part.trim());
  const values = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    values[key] = value;
  }

  if (!values.t || !values[SIGNATURE_SCHEME]) {
    return null;
  }

  return { timestamp: values.t, signature: values[SIGNATURE_SCHEME] };
};

const getRawBody = (req) => {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  const fallback = JSON.stringify(req.body || {});
  return Buffer.from(fallback);
};

const timingSafeCompare = (a, b) => {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

const purgeReplayCache = (nowMs, toleranceMs) => {
  for (const [key, seenAt] of seenSignatures.entries()) {
    if (nowMs - seenAt > toleranceMs) {
      seenSignatures.delete(key);
    }
  }
};

const webhookSignature = (req, res, next) => {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'Webhook Signing Secret Missing',
      message: 'Webhook signing secret is not configured on the server.',
    });
  }

  const header = req.header(SIGNATURE_HEADER) || req.header('x-signature');
  const parsed = parseSignatureHeader(header);
  const timestampHeader = req.header(TIMESTAMP_HEADER);

  const timestamp = parsed?.timestamp || timestampHeader;
  const signature = parsed?.signature || (header && !parsed ? header : null);

  if (!timestamp || !signature) {
    return res.status(401).json({
      error: 'Invalid Webhook Signature',
      message: 'Missing signature or timestamp header.',
    });
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    return res.status(401).json({
      error: 'Invalid Webhook Signature',
      message: 'Timestamp must be a valid unix epoch (seconds).',
    });
  }

  const toleranceMs = getToleranceMs();
  const nowMs = Date.now();
  if (Math.abs(nowMs - timestampMs) > toleranceMs) {
    return res.status(403).json({
      error: 'Webhook Signature Expired',
      message: 'Timestamp is outside the allowed tolerance window.',
    });
  }

  purgeReplayCache(nowMs, toleranceMs);
  const replayKey = `${timestamp}.${signature}`;
  if (seenSignatures.has(replayKey)) {
    return res.status(403).json({
      error: 'Webhook Replay Detected',
      message: 'This webhook payload has already been processed.',
    });
  }

  const rawBody = getRawBody(req);
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (!timingSafeCompare(computed, signature)) {
    return res.status(401).json({
      error: 'Invalid Webhook Signature',
      message: 'Signature does not match payload.',
    });
  }

  seenSignatures.set(replayKey, nowMs);
  return next();
};

module.exports = webhookSignature;
