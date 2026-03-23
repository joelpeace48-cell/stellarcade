# Repo Hygiene Manifest — Wave Tracking

Machine-generated record for issue #192. Each entry lists the file or section,
its disposition, and the proof used to justify the decision.

---

## Wave 1 — Frontend

| File | Status | Reason |
|------|--------|--------|
| `frontend/README.md` | **kept** | Only file present; no dead modules to remove |

No removals. Frontend surface is a single README stub.

---

## Wave 2 — Backend

### Kept (active consumers verified)

| File | Active consumers |
|------|-----------------|
| `backend/src/utils/logger.js` | 11 consumers: controllers, middleware, models, services, `server.js` |
| `backend/src/utils/contractMonitoringAlerts.js` | `contractMonitoring.service.js` + `tests/unit/contractMonitoringAlerts.test.js` |
| `backend/src/utils/deployment.util.js` | `deployment.service.js` |

### Flagged for Follow-up (kept — not tied to removed modules)

| File | Note |
|------|------|
| `backend/tests/unit/placeholder.test.js` | Zero functional value (`expect(true).toBe(true)`); candidate for replacement with real unit tests |
| `backend/tests/integration/placeholder.test.js` | Same as above |

No deletions in Wave 2. All `backend/src/utils/` modules have verified consumers.
(`backend/src/utils/helpers.js` was already removed upstream prior to this wave.)

---

## Wave 3 — Contracts (structure/noise only)

### Deleted (config noise — 42 crates)

**Proof**: `cargo` warns `profiles for the non root package will be ignored` for every affected crate because `contracts/Cargo.toml` (workspace root) already defines the canonical `[profile.release]` block. The member-level copies were ignored entirely and generated one warning per crate on every build.

Removed `[profile.release]` block from:

| Crate | Crate |
|-------|-------|
| achievement-badge | color-prediction |
| comprehensive-test-suite | contract-address-registry |
| contract-circuit-breaker | contract-health-registry |
| contract-metadata-registry | contract-monitoring |
| contract-upgrade-timelock | cross-chain-bridge |
| cross-contract-call-guard | daily-reward-emission |
| daily-trivia | dynamic-fee-policy |
| epoch-scheduler | escrow-vault |
| exploit-prevention | fee-management |
| gas-optimization-analysis | governance-token |
| higher-lower | matchmaking-queue |
| multiplayer-room | nft-reward |
| number-guess | oracle-integration |
| pattern-puzzle | penalty-slashing |
| prize-pool | random-generator |
| referral-system | revenue-split |
| reward-distribution | settlement-queue |
| speed-trivia | staking |
| tournament-system | treasury |
| treasury-allocation | upgrade-mechanism |
| vip-subscription | wordle-clone |

### Kept

| File | Reason |
|------|--------|
| All `src/lib.rs` files | Contract source — no logic or interface changes in this wave |
| `contracts/README.md` + per-crate READMEs | Valid documentation — actively describes contracts |
| `contracts/Cargo.toml` (workspace root) | Canonical `[profile.release]` lives here — unchanged |

---

## Exit Criteria Verification

| Check | Result |
|-------|--------|
| `grep -rl "[profile.release]" contracts/*/Cargo.toml` | **0 hits** — all duplicates removed |
| Backend tests after Wave 2 | N/A — no deletions in Wave 2 |
| No broken imports from any removed content | `grep -r "utils/helpers" backend/` → 0 hits (was already removed upstream) |
| All `contracts/*/Cargo.toml` still parse correctly | `cargo metadata --manifest-path contracts/Cargo.toml` succeeds |
