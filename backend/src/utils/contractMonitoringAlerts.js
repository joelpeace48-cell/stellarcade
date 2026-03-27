const FAILED_SETTLEMENT_ALERT_THRESHOLD = 3;
const HIGH_ERROR_RATE_PERCENT = 20;
const HIGH_ERROR_RATE_MIN_SAMPLE = 10;

const isHighErrorRate = (errorEvents, totalEvents) => {
  if (totalEvents < HIGH_ERROR_RATE_MIN_SAMPLE || totalEvents === 0) {
    return false;
  }

  return ((errorEvents * 100) / totalEvents) >= HIGH_ERROR_RATE_PERCENT;
};

const evaluateMonitoringAlerts = (metrics, paused = false) => ({
  paused: Boolean(paused),
  failedSettlementAlert: metrics.settlementFailed >= FAILED_SETTLEMENT_ALERT_THRESHOLD,
  highErrorRate: isHighErrorRate(metrics.errorEvents, metrics.totalEvents),
});

const buildIngestionFailureAlert = (failurePayload = {}) => ({
  type: 'contract_ingestion_failure',
  contractId: failurePayload.contractId || 'unknown',
  eventId: failurePayload.eventId || 'unknown',
  eventKind: failurePayload.eventKind || 'unknown',
  stage: failurePayload.stage || 'unknown',
  retry: {
    count: typeof failurePayload.retryCount === 'number' ? failurePayload.retryCount : 0,
    willRetry: Boolean(failurePayload.willRetry),
  },
  reason: failurePayload.reason || 'unknown',
});

module.exports = {
  evaluateMonitoringAlerts,
  isHighErrorRate,
  buildIngestionFailureAlert,
};
