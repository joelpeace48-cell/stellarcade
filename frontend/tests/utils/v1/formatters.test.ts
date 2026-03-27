/**
 * Unit tests for formatters (amount, address, date, and locale-aware presets).
 */

import { describe, it, expect } from "vitest";
import {
  FALLBACK_ADDRESS,
  FALLBACK_AMOUNT,
  FALLBACK_DATE,
  STROOPS_PER_XLM,
  formatAddress,
  formatAmount,
  formatDate,
  formatNumberSummary,
  formatPercentage,
  formatTokenAmount,
} from "../../../src/utils/v1/formatters";

describe("formatAmount", () => {
  it("formats stroops as XLM with default precision", () => {
    expect(formatAmount(50_000_000n)).toBe("5");
    expect(formatAmount(10_000_000n)).toBe("1");
    expect(formatAmount(0n)).toBe("0");
  });

  it("accepts number in stroops", () => {
    expect(formatAmount(50_000_000)).toBe("5");
    expect(formatAmount(12_500_000)).toBe("1.25");
  });

  it("accepts string in stroops", () => {
    expect(formatAmount("50000000")).toBe("5");
    expect(formatAmount("10000000")).toBe("1");
  });

  it("appends symbol when provided", () => {
    expect(formatAmount(10_000_000n, { symbol: "XLM" })).toBe("1 XLM");
    expect(formatAmount(5_000_000n, { symbol: "XLM" })).toBe("0.5 XLM");
  });

  it("respects precision option", () => {
    expect(formatAmount(12_345_678n, { precision: 2 })).toBe("1.23");
    expect(formatAmount(12_345_678n, { precision: 0 })).toBe("1");
    expect(formatAmount(99_999_999n, { precision: 7 })).toBe("9.9999999");
  });

  it("fromStroops false treats value as whole units", () => {
    expect(formatAmount(100, { fromStroops: false })).toBe("100");
    expect(formatAmount(1.5, { fromStroops: false, precision: 1 })).toBe("1.5");
  });

  it("returns fallback for invalid values", () => {
    expect(formatAmount(null)).toBe(FALLBACK_AMOUNT);
    expect(formatAmount(undefined)).toBe(FALLBACK_AMOUNT);
    expect(formatAmount(-1n)).toBe(FALLBACK_AMOUNT);
    expect(formatAmount(-100)).toBe(FALLBACK_AMOUNT);
    expect(formatAmount("not-a-number")).toBe(FALLBACK_AMOUNT);
    expect(formatAmount("")).toBe(FALLBACK_AMOUNT);
    expect(formatAmount(Number.NaN)).toBe(FALLBACK_AMOUNT);
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe(FALLBACK_AMOUNT);
  });

  it("clamps precision to safe range when invalid option", () => {
    expect(formatAmount(12_345_678n, { precision: -1 })).toBe("1.2345678");
    expect(formatAmount(12_345_678n, { precision: 100 })).toBe("1.2345678");
  });

  it("is deterministic across repeated calls", () => {
    const a = formatAmount(50_000_000n, { symbol: "XLM" });
    const b = formatAmount(50_000_000n, { symbol: "XLM" });
    expect(a).toBe(b);
  });
});

describe("locale-aware presets", () => {
  it("formats token amounts with locale-aware grouping", () => {
    expect(formatTokenAmount(1234.56, { locale: "de-DE", symbol: "XLM" })).toBe(
      "1.234,56 XLM",
    );
  });

  it("supports stroop conversion in the token preset", () => {
    expect(
      formatTokenAmount(STROOPS_PER_XLM * 1234, {
        locale: "en-US",
        fromStroops: true,
        symbol: "XLM",
      }),
    ).toBe("1,234 XLM");
  });

  it("formats percentages with explicit locale-aware rounding", () => {
    expect(formatPercentage(0.125, { locale: "fr-FR" })).toBe("12,5 %");
  });

  it("formats compact numeric summaries", () => {
    expect(formatNumberSummary(12_500, { locale: "en-US" })).toBe("12.5K");
  });

  it("falls back to the default locale for malformed locale identifiers", () => {
    expect(formatTokenAmount(1234.56, { locale: "bad-locale", symbol: "XLM" })).toBe(
      "1,234.56 XLM",
    );
  });

  it("returns fallback for invalid preset input", () => {
    expect(formatTokenAmount("not-a-number")).toBe(FALLBACK_AMOUNT);
    expect(formatPercentage("oops")).toBe(FALLBACK_AMOUNT);
    expect(formatNumberSummary(undefined)).toBe(FALLBACK_AMOUNT);
  });
});

describe("formatAddress", () => {
  const validAddress = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJ";

  it("truncates with default 4...4", () => {
    expect(formatAddress(validAddress)).toBe("GABC...GHIJ");
  });

  it("respects startChars and endChars", () => {
    expect(formatAddress(validAddress, { startChars: 6, endChars: 4 })).toBe(
      "GABCDE...GHIJ",
    );
    expect(formatAddress(validAddress, { startChars: 2, endChars: 2 })).toBe(
      "GA...IJ",
    );
  });

  it("respects custom separator", () => {
    expect(formatAddress(validAddress, { separator: "..." })).toBe(
      "GABC...GHIJ",
    );
  });

  it("returns full string when shorter than start+end", () => {
    const exact = "GABC234567AB";
    expect(formatAddress(exact, { startChars: 6, endChars: 6 })).toBe(exact);
  });

  it("returns fallback for invalid values", () => {
    expect(formatAddress(null)).toBe(FALLBACK_ADDRESS);
    expect(formatAddress(undefined)).toBe(FALLBACK_ADDRESS);
    expect(formatAddress("")).toBe(FALLBACK_ADDRESS);
    expect(formatAddress("GAB")).toBe(FALLBACK_ADDRESS);
    expect(formatAddress("GABC1234567890!!!")).toBe(FALLBACK_ADDRESS);
    expect(formatAddress("gabcdefghijkl")).toBe(FALLBACK_ADDRESS);
  });

  it("trims whitespace before validating", () => {
    expect(formatAddress(`  ${validAddress}  `)).toBe("GABC...GHIJ");
  });

  it("clamps startChars/endChars to 0-20", () => {
    expect(formatAddress(validAddress, { startChars: 100, endChars: 0 })).toBe(
      validAddress.slice(0, 20) + "...",
    );
  });

  it("is deterministic across repeated calls", () => {
    const a = formatAddress(validAddress);
    const b = formatAddress(validAddress);
    expect(a).toBe(b);
  });
});

describe("formatDate", () => {
  const epochMs = 0;
  const someMs = 1_700_000_000_000;

  it("formats epoch ms in local by default", () => {
    const out = formatDate(epochMs);
    expect(out).toBeTruthy();
    expect(out).not.toBe(FALLBACK_DATE);
    expect(out).toContain("1970");
  });

  it("formats with useUtc true", () => {
    const out = formatDate(someMs, { useUtc: true });
    expect(out).toBeTruthy();
    expect(out).not.toBe(FALLBACK_DATE);
  });

  it("accepts seconds and treats as ms when value < 1e12", () => {
    const out = formatDate(1_700_000_000, { useUtc: true });
    expect(out).toBeTruthy();
    expect(out).not.toBe(FALLBACK_DATE);
  });

  it("returns fallback for invalid values", () => {
    expect(formatDate(null)).toBe(FALLBACK_DATE);
    expect(formatDate(undefined)).toBe(FALLBACK_DATE);
    expect(formatDate(Number.NaN)).toBe(FALLBACK_DATE);
    expect(formatDate(-1)).toBe(FALLBACK_DATE);
  });

  it("uses custom fallback when provided", () => {
    expect(formatDate(null, { fallback: "N/A" })).toBe("N/A");
    expect(formatDate(Number.NaN, { fallback: "Invalid" })).toBe("Invalid");
  });

  it("respects dateStyle", () => {
    const short = formatDate(someMs, { dateStyle: "short" });
    const long = formatDate(someMs, { dateStyle: "long" });
    expect(short).toBeTruthy();
    expect(long).toBeTruthy();
  });

  it("is deterministic for same input", () => {
    const a = formatDate(someMs);
    const b = formatDate(someMs);
    expect(a).toBe(b);
  });
});

describe("formatter constants", () => {
  it("STROOPS_PER_XLM is 10^7", () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000);
  });

  it("fallback constants are non-empty strings", () => {
    expect(typeof FALLBACK_AMOUNT).toBe("string");
    expect(typeof FALLBACK_ADDRESS).toBe("string");
    expect(typeof FALLBACK_DATE).toBe("string");
    expect(FALLBACK_AMOUNT.length).toBeGreaterThan(0);
    expect(FALLBACK_ADDRESS.length).toBeGreaterThan(0);
    expect(FALLBACK_DATE.length).toBeGreaterThan(0);
  });
});
