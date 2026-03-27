// Mock database before requiring anything
const mockInsert = jest.fn().mockReturnThis();
const mockReturning = jest.fn().mockResolvedValue([{ id: 1 }]);

jest.mock('../../src/config/database', () => {
  const mock = jest.fn((_tableName) => ({
    insert: mockInsert,
    returning: mockReturning,
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  }));
  // Chain insert().returning()
  mockInsert.mockReturnValue({ returning: mockReturning });
  mock.raw = jest.fn().mockResolvedValue({});
  return mock;
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const audit = require('../../src/services/audit.service');
const logger = require('../../src/utils/logger');

describe('Audit Log Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([{ id: 1 }]);
  });

  describe('success path', () => {
    test('writes an audit entry on successful operation', async () => {
      await audit.log({
        actor: 'user-123',
        action: 'wallet.deposit',
        target: 'user-123',
        payload: { amount: 100, asset: 'XLM' },
        outcome: 'success',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'user-123',
          action: 'wallet.deposit',
          target: 'user-123',
          outcome: 'success',
          payload_hash: expect.any(String),
        })
      );
    });

    test('hashes payload data instead of storing raw', async () => {
      await audit.log({
        actor: 'user-123',
        action: 'wallet.withdraw',
        target: 'user-123',
        payload: { amount: 500, destination: 'G...' },
        outcome: 'success',
      });

      const insertCall = mockInsert.mock.calls[0][0];
      // Should be a hex SHA-256 hash, not raw payload
      expect(insertCall.payload_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(insertCall.payload).toBeUndefined();
    });

    test('includes metadata when provided', async () => {
      await audit.log({
        actor: 'user-456',
        action: 'game.play',
        target: 'coin-flip',
        outcome: 'success',
        metadata: { gameType: 'coin-flip' },
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(JSON.parse(insertCall.metadata)).toEqual({ gameType: 'coin-flip' });
    });

    test('defaults outcome to success', async () => {
      await audit.log({
        actor: 'user-789',
        action: 'wallet.deposit',
        target: 'user-789',
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.outcome).toBe('success');
    });
  });

  describe('failure path', () => {
    test('writes audit entry with failure outcome', async () => {
      await audit.log({
        actor: 'user-123',
        action: 'wallet.withdraw',
        target: 'user-123',
        outcome: 'failure',
        metadata: { error: 'Insufficient balance' },
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.outcome).toBe('failure');
      expect(JSON.parse(insertCall.metadata)).toEqual({ error: 'Insufficient balance' });
    });
  });

  describe('non-blocking behavior', () => {
    test('does not throw when audit write fails', async () => {
      mockInsert.mockReturnValue({
        returning: jest.fn().mockRejectedValue(new Error('DB write failed')),
      });

      // This should NOT throw
      await expect(
        audit.log({
          actor: 'user-123',
          action: 'wallet.deposit',
          target: 'user-123',
          outcome: 'success',
        })
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write audit log')
      );
    });

    test('logs error message when audit write fails', async () => {
      mockInsert.mockReturnValue({
        returning: jest.fn().mockRejectedValue(new Error('Connection refused')),
      });

      await audit.log({
        actor: 'user-123',
        action: 'game.play',
        target: 'coin-flip',
        outcome: 'success',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection refused')
      );
    });
  });

  describe('hashPayload', () => {
    test('returns consistent hash for same input', () => {
      const hash1 = audit.hashPayload({ amount: 100 });
      const hash2 = audit.hashPayload({ amount: 100 });
      expect(hash1).toBe(hash2);
    });

    test('normalizes object key order before hashing', () => {
      const hash1 = audit.hashPayload({ amount: 100, currency: 'XLM' });
      const hash2 = audit.hashPayload({ currency: 'XLM', amount: 100 });
      expect(hash1).toBe(hash2);
    });

    test('returns different hash for different input', () => {
      const hash1 = audit.hashPayload({ amount: 100 });
      const hash2 = audit.hashPayload({ amount: 200 });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('redaction', () => {
    test('redacts sensitive metadata fields before persisting', async () => {
      await audit.log({
        actor: 'user-999',
        action: 'wallet.deposit',
        target: 'user-999',
        metadata: {
          amount: 100,
          signature: 'secret-signature',
          nested: {
            token: 'jwt-token',
          },
        },
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(JSON.parse(insertCall.metadata)).toEqual({
        amount: 100,
        signature: '[REDACTED]',
        nested: {
          token: '[REDACTED]',
        },
      });
    });
  });
});
