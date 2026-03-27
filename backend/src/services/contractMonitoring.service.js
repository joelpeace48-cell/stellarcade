/**
 * Contract Monitoring Service
 *
 * Central service for monitoring events from all Soroban smart contracts.
 * Aggregates metrics, detects anomalies, and provides health status for the
 * entire contract ecosystem.
 *
 * ## Contract Interactions
 * This service monitors events from ALL smart contracts:
 *
 * ### Core Infrastructure Contracts
 * - `prize-pool`: Fund events, reservation events, payout events
 * - `treasury`: Deposit events, allocation events, release events
 * - `random-generator`: Request events, fulfill events
 *
 * ### Game Contracts
 * - `coin-flip`: Bet placed, game resolved, payout events
 * - `daily-trivia`: Game started, answer submitted, reward claimed
 * - `speed-trivia`: Fast trivia events
 * - `dice-roll`: Roll events, payout events
 * - All other game contracts: Game lifecycle events
 *
 * ### Platform Feature Contracts
 * - `leaderboard`: Score update events, rank change events
 * - `staking`: Stake events, unstake events, reward events
 * - `governance`: Proposal events, vote events, execution events
 * - `tournament-system`: Tournament created, joined, settled
 * - `settlement-queue`: Settlement queued, processed, failed
 * - `epoch-scheduler`: Epoch start, epoch end events
 *
 * ### Utility & Safety Contracts
 * - `contract-monitoring`: Central monitoring hub events
 * - `contract-health-registry`: Health status updates
 * - `contract-circuit-breaker`: Breaker trigger/reset events
 * - `emergency-pause`: Pause/unpause events
 * - `exploit-prevention`: Exploit detection alerts
 * - `contract-upgrade-timelock`: Upgrade scheduled/executed events
 *
 * ## Event Ingestion Flow
 *
 * 1. Service receives event from contract (via Horizon/RPC streaming)
 * 2. Validates event ID for uniqueness (prevents duplicates)
 * 3. Categorizes event by kind (settlement_success, settlement_failed, error, paused)
 * 4. Updates metrics counters
 * 5. Evaluates monitoring alerts based on thresholds
 * 6. Returns updated metrics and any triggered alerts
 *
 * ## Alert Conditions
 *
 * Alerts are triggered when:
 * - Settlement failure rate exceeds threshold
 * - Error event rate exceeds threshold
 * - System is paused (circuit breaker triggered)
 * - Unusual patterns detected (exploit prevention)
 *
 * ## Metrics Tracked
 *
 * - `totalEvents`: Total events ingested
 * - `settlementSuccess`: Successful settlement count
 * - `settlementFailed`: Failed settlement count
 * - `errorEvents`: Error event count
 * - `pausedEvents`: Pause event count
 *
 * ## Health Status
 *
 * - `running`: Normal operation
 * - `paused`: System paused (circuit breaker active)
 * - `degraded`: Elevated error rates or alerts
 *
 * @see {@link ../../docs/ARCHITECTURE.md#backend-contract-interaction-matrix} for full interaction matrix
 * @see {@link ../../docs/contracts/contract-monitoring.md} for contract documentation
 * @see {@link ../utils/contractMonitoringAlerts.js} for alert evaluation logic
 *
 * @example
 * // Ingest a contract event
 * const monitoringService = require('./contractMonitoring.service');
 *
 * const result = monitoringService.ingestEvent({
 *   eventId: 'evt_123456',
 *   kind: 'settlement_success',
 *   contract: 'prize-pool',
 *   data: { amount: 1000, winner: 'G...' }
 * });
 *
 * console.log(result.metrics); // Updated metrics
 * console.log(result.alerts);  // Any triggered alerts
 *
 * // Check system health
 * const health = monitoringService.getHealth();
 * if (health.status === 'paused') {
 *   console.error('System is paused - circuit breaker triggered');
 * }
 */
const {
  evaluateMonitoringAlerts,
  buildIngestionFailureAlert,
} = require('../utils/contractMonitoringAlerts');
const logger = require('../utils/logger');

const INITIAL_METRICS = Object.freeze({
  totalEvents: 0,
  settlementSuccess: 0,
  settlementFailed: 0,
  errorEvents: 0,
  pausedEvents: 0,
});

class ContractMonitoringService {
  constructor() {
    this.metrics = { ...INITIAL_METRICS };
    this.paused = false;
    this.seenEventIds = new Set();
  }

  ingestEvent({ eventId, kind, contractId = 'unknown', stage = 'ingest', retryCount = 0 } = {}) {
    try {
      if (!eventId) {
        throw new Error('Missing event id');
      }

      if (this.seenEventIds.has(eventId)) {
        throw new Error(`Duplicate event id: ${eventId}`);
      }

      this.seenEventIds.add(eventId);
      this.metrics.totalEvents += 1;

      switch (kind) {
        case 'settlement_success':
          this.metrics.settlementSuccess += 1;
          break;
        case 'settlement_failed':
          this.metrics.settlementFailed += 1;
          break;
        case 'error':
          this.metrics.errorEvents += 1;
          break;
        case 'paused':
          this.metrics.pausedEvents += 1;
          break;
        default:
          break;
      }

      return {
        metrics: this.getMetrics(),
        alerts: this.getAlerts(),
      };
    } catch (error) {
      const failurePayload = logger.logContractIngestionFailure({
        contractId,
        eventId,
        eventKind: kind,
        stage,
        retryCount,
        willRetry: retryCount < 3,
        reason: error.message,
      });

      return {
        metrics: this.getMetrics(),
        alerts: this.getAlerts(),
        failure: buildIngestionFailureAlert(failurePayload),
      };
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    return this.getHealth();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getAlerts() {
    return evaluateMonitoringAlerts(
      {
        totalEvents: this.metrics.totalEvents,
        settlementFailed: this.metrics.settlementFailed,
        errorEvents: this.metrics.errorEvents,
      },
      this.paused
    );
  }

  getHealth() {
    return {
      status: this.paused ? 'paused' : 'running',
      alerts: this.getAlerts(),
      metrics: this.getMetrics(),
    };
  }
}

module.exports = new ContractMonitoringService();
