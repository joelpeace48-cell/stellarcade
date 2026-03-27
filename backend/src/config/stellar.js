const StellarSdk = require('@stellar/stellar-sdk');
const logger = require('./logger');

/**
 * Configure Stellar Server instance based on environment.
 */
const network = process.env.STELLAR_NETWORK || 'testnet';
const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const isLikelyUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

if (!isLikelyUrl(horizonUrl)) {
  throw new Error('Invalid startup configuration: HORIZON_URL must be a valid http(s) URL');
}

/**
 * Resolve the network passphrase from env or derive from known network name.
 */
const resolvePassphrase = () => {
  if (process.env.NETWORK_PASSPHRASE) {
    return process.env.NETWORK_PASSPHRASE;
  }
  const passphraseMap = {
    testnet: StellarSdk.Networks.TESTNET,
    public: StellarSdk.Networks.PUBLIC,
    mainnet: StellarSdk.Networks.PUBLIC,
    futurenet: StellarSdk.Networks.FUTURENET,
    sandbox: StellarSdk.Networks.SANDBOX,
    standalone: StellarSdk.Networks.STANDALONE,
  };
  const resolved = passphraseMap[network.toLowerCase()];
  if (!resolved) {
    logger.warn(
      `Unknown STELLAR_NETWORK "${network}", defaulting to TESTNET passphrase`
    );
    return StellarSdk.Networks.TESTNET;
  }
  return resolved;
};

const passphrase = resolvePassphrase();
const server = new StellarSdk.Horizon.Server(horizonUrl);

logger.info(`Stellar SDK initialized for ${network} at ${horizonUrl}`);

/**
 * Helper to get Contract Client (Skeleton)
 */
const getContractClient = (contractId) => {
  // TODO: Add Soroban client initialization logic when SDK v12+ is integrated
  return {
    contractId,
    invoke: async (method, _args) => {
      logger.info(`Invoking ${method} on ${contractId}`);
      // Mock result
      return { status: 'pending' };
    },
  };
};

module.exports = {
  server,
  network,
  passphrase,
  horizonUrl,
  getContractClient,
};
