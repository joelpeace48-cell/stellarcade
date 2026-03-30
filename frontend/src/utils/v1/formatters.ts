/**
 * Formatters - amount, address, and date formatting helpers (v1).
 *
 * Pure, UI-agnostic utilities for logs, displays, and analytics.
 * All functions validate inputs and return deterministic fallbacks for invalid data.
 *
 * Locale-aware number presets normalize malformed or unsupported locales back to
 * the app default (`en-US`) so cards, tables, and status components stay stable.
 *
 * @module utils/v1/formatters
 */

import { resolveIntlLocale } from "../../i18n/provider";

/** Stellar native asset: 1 XLM = 10^7 stroops. */
export const STROOPS_PER_XLM = 10_000_000;

/** Default fallback when amount cannot be formatted. */
export const FALLBACK_AMOUNT = "--";

/** Default fallback when address cannot be formatted. */
export const FALLBACK_ADDRESS = "--";

/** Default fallback when date cannot be formatted. */
export const FALLBACK_DATE = "--";

export const TOKEN_FORMAT_PRESET = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
} as const;

export const PERCENTAGE_FORMAT_PRESET = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
} as const;

export const NUMBER_SUMMARY_FORMAT_PRESET = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
} as const;

export interface FormatAmountOptions {
  /** Number of decimal places. Default 7 for stroops-derived XLM. */
  precision?: number;
  /** Symbol to append (e.g. "XLM"). Omitted if not provided. */
  symbol?: string;
  /** If true, value is interpreted as stroops (divide by STROOPS_PER_XLM). Default true for Stellar. */
  fromStroops?: boolean;
  /** Locale for number formatting (e.g. "en-US"). Optional. */
  locale?: string;
}

export interface FormatAddressOptions {
  /** Characters to show at start. Default 4. */
  startChars?: number;
  /** Characters to show at end. Default 4. */
  endChars?: number;
  /** Separator between start and end. Default "...". */
  separator?: string;
}

export interface FormatDateOptions {
  /** If true, format in UTC; otherwise use local time. Default false. */
  useUtc?: boolean;
  /** BCP 47 locale (e.g. "en-US"). Optional; uses Intl default if omitted. */
  locale?: string;
  /** Fallback when timestamp is invalid. Default FALLBACK_DATE. */
  fallback?: string;
  /** DateStyle for Intl.DateTimeFormat. Default "medium". */
  dateStyle?: "full" | "long" | "medium" | "short";
  /** TimeStyle for Intl.DateTimeFormat. Optional. */
  timeStyle?: "full" | "long" | "medium" | "short";
}

export interface FormatTokenPresetOptions {
  locale?: string;
  symbol?: string;
  fromStroops?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

export interface FormatPercentOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

export interface FormatNumberSummaryOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

function isNil(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

function isSafeInteger(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && Number.isSafeInteger(n);
}

function clampFractionDigits(value: number | undefined, fallback: number): number {
  if (!isSafeInteger(value)) return fallback;
  return value >= 0 && value <= 20 ? value : fallback;
}

function normalizeNumber(
  value: bigint | number | string | null | undefined,
): number | null {
  if (isNil(value) || value === "") return null;

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatNumericValue(
  value: number,
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): string {
  const formatter = new Intl.NumberFormat(resolveIntlLocale(locale), options);
  return formatter.format(value);
}

/** Stellar public key is 56 chars, base32; we only need to guard length and non-empty. */
function isAddressLike(s: string): boolean {
  return (
    typeof s === "string" &&
    s.length >= 12 &&
    s.length <= 64 &&
    /^[A-Z0-9]+$/.test(s)
  );
}

/**
 * Format a token amount with optional precision and symbol.
 *
 * Accepts stroops (bigint/number) or whole units. Invalid input returns FALLBACK_AMOUNT.
 */
export function formatAmount(
  value: bigint | number | string | null | undefined,
  options: FormatAmountOptions = {},
): string {
  if (isNil(value) || value === "") return FALLBACK_AMOUNT;

  const { precision = 7, symbol = "", fromStroops = true, locale } = options;
  const normalized = normalizeNumber(value);
  if (normalized === null || normalized < 0) return FALLBACK_AMOUNT;

  const num = fromStroops ? normalized / STROOPS_PER_XLM : normalized;
  const formatted = formatNumericValue(num, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: clampFractionDigits(precision, 7),
  });

  return symbol ? `${formatted} ${symbol}`.trim() : formatted;
}

/**
 * Locale-aware token preset for balances and wager displays.
 */
export function formatTokenAmount(
  value: bigint | number | string | null | undefined,
  options: FormatTokenPresetOptions = {},
): string {
  const {
    locale,
    symbol,
    fromStroops = false,
    minimumFractionDigits = TOKEN_FORMAT_PRESET.minimumFractionDigits,
    maximumFractionDigits = TOKEN_FORMAT_PRESET.maximumFractionDigits,
    fallback = FALLBACK_AMOUNT,
  } = options;

  const normalized = normalizeNumber(value);
  if (normalized === null || normalized < 0) {
    return fallback;
  }

  const amount = fromStroops ? normalized / STROOPS_PER_XLM : normalized;
  const formatted = formatNumericValue(amount, locale, {
    minimumFractionDigits: clampFractionDigits(
      minimumFractionDigits,
      TOKEN_FORMAT_PRESET.minimumFractionDigits,
    ),
    maximumFractionDigits: clampFractionDigits(
      maximumFractionDigits,
      TOKEN_FORMAT_PRESET.maximumFractionDigits,
    ),
  });

  return symbol ? `${formatted} ${symbol}`.trim() : formatted;
}

/**
 * Locale-aware percentage preset. Accepts ratio values like `0.125` -> `12.5%`.
 */
export function formatPercentage(
  value: number | string | null | undefined,
  options: FormatPercentOptions = {},
): string {
  const {
    locale,
    minimumFractionDigits = PERCENTAGE_FORMAT_PRESET.minimumFractionDigits,
    maximumFractionDigits = PERCENTAGE_FORMAT_PRESET.maximumFractionDigits,
    fallback = FALLBACK_AMOUNT,
  } = options;

  const normalized = normalizeNumber(value);
  if (normalized === null) {
    return fallback;
  }

  return formatNumericValue(normalized, locale, {
    style: "percent",
    minimumFractionDigits: clampFractionDigits(
      minimumFractionDigits,
      PERCENTAGE_FORMAT_PRESET.minimumFractionDigits,
    ),
    maximumFractionDigits: clampFractionDigits(
      maximumFractionDigits,
      PERCENTAGE_FORMAT_PRESET.maximumFractionDigits,
    ),
  });
}

/**
 * Compact numeric preset for tables, badges, and summary metrics.
 */
export function formatNumberSummary(
  value: number | string | bigint | null | undefined,
  options: FormatNumberSummaryOptions = {},
): string {
  const {
    locale,
    minimumFractionDigits = NUMBER_SUMMARY_FORMAT_PRESET.minimumFractionDigits,
    maximumFractionDigits = NUMBER_SUMMARY_FORMAT_PRESET.maximumFractionDigits,
    fallback = FALLBACK_AMOUNT,
  } = options;

  const normalized = normalizeNumber(value);
  if (normalized === null) {
    return fallback;
  }

  return formatNumericValue(normalized, locale, {
    notation: "compact",
    minimumFractionDigits: clampFractionDigits(
      minimumFractionDigits,
      NUMBER_SUMMARY_FORMAT_PRESET.minimumFractionDigits,
    ),
    maximumFractionDigits: clampFractionDigits(
      maximumFractionDigits,
      NUMBER_SUMMARY_FORMAT_PRESET.maximumFractionDigits,
    ),
  });
}

/**
 * Truncate a wallet address for display (e.g. GABC...xyz1).
 *
 * Validates address-like shape (length 12-56, base32 chars). Invalid input returns FALLBACK_ADDRESS.
 */
export function formatAddress(
  address: string | null | undefined,
  options: FormatAddressOptions = {},
): string {
  if (isNil(address) || typeof address !== "string") return FALLBACK_ADDRESS;
  const trimmed = address.trim();
  if (!isAddressLike(trimmed)) return FALLBACK_ADDRESS;

  const startChars = Math.max(0, Math.min(20, options.startChars ?? 4));
  const endChars = Math.max(0, Math.min(20, options.endChars ?? 4));
  const separator = typeof options.separator === "string" ? options.separator : "...";

  if (trimmed.length <= startChars + endChars) return trimmed;
  const start = trimmed.slice(0, startChars);
  const end = endChars > 0 ? trimmed.slice(-endChars) : "";
  return `${start}${separator}${end}`;
}

/**
 * Format a timestamp for display in local or UTC.
 *
 * Accepts ms or seconds (if value < 1e12, treated as seconds). Invalid input returns fallback.
 */
export function formatDate(
  timestamp: number | null | undefined,
  options: FormatDateOptions = {},
): string {
  if (isNil(timestamp) || typeof timestamp !== "number") {
    return options.fallback ?? FALLBACK_DATE;
  }

  let ms = timestamp;
  if (Number.isFinite(ms) && ms > 0 && ms < 1e12) ms = ms * 1000;
  if (!Number.isFinite(ms) || ms < 0) return options.fallback ?? FALLBACK_DATE;

  const fallback = options.fallback ?? FALLBACK_DATE;
  try {
    const opts: Intl.DateTimeFormatOptions = {
      dateStyle: options.dateStyle ?? "medium",
      timeZone: options.useUtc ? "UTC" : undefined,
    };
    if (options.timeStyle) opts.timeStyle = options.timeStyle;
    const formatter = new Intl.DateTimeFormat(resolveIntlLocale(options.locale), opts);
    return formatter.format(ms);
  } catch {
    return fallback;
  }
}

/**
 * Format a transaction timestamp for receipt display.
 *
 * Returns a full date-time string suitable for receipts (e.g., "Mar 29, 2026, 3:45 PM").
 * Accepts ms or seconds (if value < 1e12, treated as seconds). Invalid input returns fallback.
 */
export function formatTxTimestamp(
  timestamp: number | null | undefined,
  options: FormatDateOptions = {},
): string {
  return formatDate(timestamp, {
    ...options,
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.timeStyle ?? "short",
  });
}

/**
 * Truncate a transaction hash for receipt display.
 *
 * Returns a shortened hash (e.g., "GABC...xyz1").
 * Validates hash-like shape (length 12-64, base32 chars). Invalid input returns FALLBACK_ADDRESS.
 */
export function truncateHash(
  hash: string | null | undefined,
  options: FormatAddressOptions = {},
): string {
  return formatAddress(hash, {
    startChars: options.startChars ?? 8,
    endChars: options.endChars ?? 8,
    separator: options.separator ?? "...",
  });
}

/**
 * Format a value for display alongside a copy affordance.
 *
 * Returns `{ display, full }` where `display` is truncated for inline
 * rendering and `full` is the raw value to copy. Callers can use `display`
 * as visible text and hand `full` to `useCopyFeedback.copy()`.
 */
export function formatCopyableValue(
  value: string | null | undefined,
  options: FormatAddressOptions & { label?: string } = {},
): { display: string; full: string; ariaLabel: string } {
  const full = typeof value === "string" ? value.trim() : "";
  if (!full) {
    return { display: FALLBACK_ADDRESS, full: "", ariaLabel: "Nothing to copy" };
  }
  const display = formatAddress(full, {
    startChars: options.startChars ?? 6,
    endChars: options.endChars ?? 4,
    separator: options.separator ?? "…",
  });
  const label = options.label ?? "value";
  return { display, full, ariaLabel: `Copy ${label} ${display}` };
}
