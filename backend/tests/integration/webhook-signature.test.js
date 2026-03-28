const crypto = require('crypto');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.WEBHOOK_SIGNING_SECRET = 'test_secret';
process.env.WEBHOOK_SIGNATURE_TOLERANCE_SEC = '300';

const app = require('../../src/server');

const signPayload = (payload, timestamp, secret) => {
  const body = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
};

describe('Webhook signature middleware', () => {
  it('accepts a valid signature', async () => {
    const payload = { event: 'payment.succeeded' };
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(payload, timestamp, process.env.WEBHOOK_SIGNING_SECRET);

    const res = await request(app)
      .post('/api/v1/webhook')
      .set('X-Webhook-Signature', `t=${timestamp},v1=${signature}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const payload = { event: 'payment.failed' };
    const timestamp = Math.floor(Date.now() / 1000);

    const res = await request(app)
      .post('/api/v1/webhook')
      .set('X-Webhook-Signature', `t=${timestamp},v1=invalid`)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid Webhook Signature');
  });

  it('rejects a stale timestamp', async () => {
    const payload = { event: 'payment.stale' };
    const timestamp = Math.floor(Date.now() / 1000) - 1000;
    const signature = signPayload(payload, timestamp, process.env.WEBHOOK_SIGNING_SECRET);

    const res = await request(app)
      .post('/api/v1/webhook')
      .set('X-Webhook-Signature', `t=${timestamp},v1=${signature}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Webhook Signature Expired');
  });

  it('rejects replayed payloads', async () => {
    const payload = { event: 'payment.replay' };
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(payload, timestamp, process.env.WEBHOOK_SIGNING_SECRET);
    const header = `t=${timestamp},v1=${signature}`;

    const first = await request(app)
      .post('/api/v1/webhook')
      .set('X-Webhook-Signature', header)
      .send(payload);

    expect(first.status).toBe(200);

    const replay = await request(app)
      .post('/api/v1/webhook')
      .set('X-Webhook-Signature', header)
      .send(payload);

    expect(replay.status).toBe(403);
    expect(replay.body.error).toBe('Webhook Replay Detected');
  });
});
