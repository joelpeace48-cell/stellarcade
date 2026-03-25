/**
 * Unit tests for SorobanContractClient.
 *
 * All network calls are mocked; no real Soroban RPC is contacted.
 */

vi.mock("@stellar/stellar-sdk", async () => await import("../__mocks__/stellar-sdk"));

import {
  devClearContractSimResults,
  devRegisterContractSimResult,
} from "../../src/services/soroban-contract-dev";
import { SorobanContractClient } from "../../src/services/soroban-contract-client";
import { ContractAddressRegistry } from "../../src/store/contractAddressRegistry";
import { SorobanErrorCode } from "../../src/types/errors";
import {
  MockWalletProvider,
  TEST_PUBLIC_KEY,
  TESTNET_PASSPHRASE,
  disconnectedWallet,
  wrongNetworkWallet,
} from "../__mocks__/wallet";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const VALID_CONTRACT_ADDR = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const VALID_STELLAR_ADDR  = TEST_PUBLIC_KEY;
// A second valid Stellar address for "user" params
const VALID_USER_ADDR     = "GD5XFLZCQMBNP4YSIJGG3QN3LWHT6XUWGNB2B77BAJMLSPP57P6C6OKY";

function makeRegistry(): ContractAddressRegistry {
  return ContractAddressRegistry.fromObject({
    prizePool: VALID_CONTRACT_ADDR,
    achievementBadge: VALID_CONTRACT_ADDR,
    accessControl: VALID_CONTRACT_ADDR,
    coinFlip: VALID_CONTRACT_ADDR,
    randomGenerator: VALID_CONTRACT_ADDR,
  });
}

function makeClient(walletOverride?: MockWalletProvider): SorobanContractClient {
  return new SorobanContractClient(
    "https://soroban-testnet.stellar.org",
    TESTNET_PASSPHRASE,
    makeRegistry(),
    walletOverride ?? new MockWalletProvider(),
  );
}

// ── Input validation tests ────────────────────────────────────────────────────

describe("SorobanContractClient — input validation", () => {
  let client: SorobanContractClient;
  beforeEach(() => { client = makeClient(); });

  // ── AchievementBadge ────────────────────────────────────────────────────────

  describe("badge_define()", () => {
    it("rejects an invalid admin address", async () => {
      const result = await client.badge_define("not-an-address", {
        badgeId: 1n,
        criteriaHash: "a".repeat(64),
        reward: 0n,
      });
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects a criteria hash that is not 64 hex chars", async () => {
      const result = await client.badge_define(VALID_STELLAR_ADDR, {
        badgeId: 1n,
        criteriaHash: "short",
        reward: 0n,
      });
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects a negative reward", async () => {
      const result = await client.badge_define(VALID_STELLAR_ADDR, {
        badgeId: 1n,
        criteriaHash: "a".repeat(64),
        reward: -1n,
      });
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("accepts a zero reward (no reward badge)", async () => {
      // Will fail at RPC level (mocked to succeed), but should pass validation.
      const result = await client.badge_define(VALID_STELLAR_ADDR, {
        badgeId: 1n,
        criteriaHash: "a".repeat(64),
        reward: 0n,
      });
      // Validation passes; mock wallet + SDK may succeed or fail at invoke level.
      // We only care that validation did NOT throw InvalidParameter.
      if (!result.success) {
        expect(result.error.code).not.toBe(SorobanErrorCode.InvalidParameter);
      }
    });
  });

  describe("badge_evaluateUser()", () => {
    it("rejects an invalid user address", async () => {
      const result = await client.badge_evaluateUser(VALID_STELLAR_ADDR, "bad", 1n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects a negative badgeId", async () => {
      const result = await client.badge_evaluateUser(VALID_STELLAR_ADDR, VALID_USER_ADDR, -1n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  describe("badge_award()", () => {
    it("rejects an invalid admin address", async () => {
      const result = await client.badge_award("INVALID", VALID_USER_ADDR, 1n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  describe("badge_badgesOf()", () => {
    it("rejects an invalid user address", async () => {
      const result = await client.badge_badgesOf("not-valid");
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  // ── PrizePool ───────────────────────────────────────────────────────────────

  describe("pool_fund()", () => {
    it("rejects a non-Stellar from address", async () => {
      const result = await client.pool_fund("INVALID", 100n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects amount = 0", async () => {
      const result = await client.pool_fund(VALID_STELLAR_ADDR, 0n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects negative amount", async () => {
      const result = await client.pool_fund(VALID_STELLAR_ADDR, -50n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  describe("pool_reserve()", () => {
    it("rejects a negative gameId", async () => {
      const result = await client.pool_reserve(VALID_STELLAR_ADDR, -1n, 100n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  describe("pool_payout()", () => {
    it("rejects an invalid `to` address", async () => {
      const result = await client.pool_payout(VALID_STELLAR_ADDR, "BAD_ADDR", 1n, 100n);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  // ── AccessControl ───────────────────────────────────────────────────────────

  describe("acl_grantRole()", () => {
    it("rejects an empty role", async () => {
      const result = await client.acl_grantRole("", VALID_STELLAR_ADDR);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects an invalid account address", async () => {
      const result = await client.acl_grantRole("ADMIN", "INVALID");
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });

  // ── CoinFlip ────────────────────────────────────────────────────────────────

  describe("coinFlip_play()", () => {
    it("rejects an invalid player address", async () => {
      const result = await client.coinFlip_play("INVALID", 100n, 0, "a".repeat(64));
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects choice other than 0 or 1", async () => {
      const result = await client.coinFlip_play(
        VALID_STELLAR_ADDR, 100n, 2 as 0 | 1, "a".repeat(64)
      );
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });

    it("rejects an invalid hex seed", async () => {
      const result = await client.coinFlip_play(VALID_STELLAR_ADDR, 100n, 0, "not-hex");
      expect(result.success).toBe(false);
      expect(!result.success && result.error.code).toBe(SorobanErrorCode.InvalidParameter);
    });
  });
});

// ── Wallet precondition tests ─────────────────────────────────────────────────

describe("SorobanContractClient — wallet preconditions", () => {
  it("returns WalletNotConnected when wallet is disconnected", async () => {
    const client = makeClient(disconnectedWallet());
    const result = await client.pool_fund(VALID_STELLAR_ADDR, 100n);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.code).toBe(SorobanErrorCode.WalletNotConnected);
  });

  it("returns NetworkMismatch when wallet is on wrong network", async () => {
    const client = makeClient(wrongNetworkWallet());
    const result = await client.pool_fund(VALID_STELLAR_ADDR, 100n);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.code).toBe(SorobanErrorCode.NetworkMismatch);
  });
});

// ── Idempotency key tracking ──────────────────────────────────────────────────

describe("SorobanContractClient — idempotency key tracking", () => {
  it("emits a console warning on duplicate idempotency key", async () => {
    const client = makeClient();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // First call — no warning.
    await client.badge_badgesOf(VALID_STELLAR_ADDR, { idempotencyKey: "key-123" });
    expect(warnSpy).not.toHaveBeenCalled();

    // Second call with same key — warning expected.
    await client.badge_badgesOf(VALID_STELLAR_ADDR, { idempotencyKey: "key-123" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("key-123"),
    );

    warnSpy.mockRestore();
  });
});

// ── Error mapping ─────────────────────────────────────────────────────────────

describe("SorobanContractClient — error mapping", () => {
  it("maps user-rejection messages to UserRejected code", async () => {
    const wallet = new MockWalletProvider();
    wallet.rejectNextSign();
    const client = makeClient(wallet);

    const result = await client.pool_fund(VALID_STELLAR_ADDR, 100n);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.code).toBe(SorobanErrorCode.UserRejected);
  });
});

describe("SorobanContractClient — dev contract simulation hooks", () => {
  afterEach(() => {
    devClearContractSimResults();
  });

  it("pool_getState returns dev-registered mock when present", async () => {
    if (import.meta.env.PROD) return;
    const client = makeClient();
    devRegisterContractSimResult(VALID_CONTRACT_ADDR, "get_pool_state", {
      success: true,
      data: { available: 77n, reserved: 3n },
    });
    const result = await client.pool_getState();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.available).toBe(77n);
      expect(result.data.reserved).toBe(3n);
    }
  });
});
