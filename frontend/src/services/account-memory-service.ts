/**
 * Persists a short list of recently-used wallet accounts in localStorage.
 * Kept intentionally simple: no encryption, no expiry — just address + metadata.
 */

import type { RecentAccount } from '../components/v1/AccountSwitcher.types';

const STORAGE_KEY = 'stc_recent_accounts_v1';
const MAX_ENTRIES = 5;

function load(): RecentAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentAccount[];
  } catch {
    return [];
  }
}

function save(accounts: RecentAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // localStorage may be unavailable (private-browsing limits, etc.)
  }
}

export function getRecentAccounts(): RecentAccount[] {
  return load().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function recordAccountUsage(account: Omit<RecentAccount, 'lastUsedAt'>): void {
  const existing = load().filter((a) => a.address !== account.address);
  const updated: RecentAccount = { ...account, lastUsedAt: Date.now() };
  const next = [updated, ...existing].slice(0, MAX_ENTRIES);
  save(next);
}

export function removeAccount(address: string): void {
  const next = load().filter((a) => a.address !== address);
  save(next);
}

export function clearRecentAccounts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
