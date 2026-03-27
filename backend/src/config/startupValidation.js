const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
];

const REQUIRED_IF_NO_DATABASE_URL = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
];

const isPositiveInteger = (value) => /^\d+$/.test(value) && Number(value) > 0;

const isValidStellarNetwork = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['test', 'testnet', 'public', 'mainnet', 'futurenet', 'sandbox', 'standalone'].includes(normalized);
};

const collectValidationErrors = (env) => {
  const errors = [];

  REQUIRED_ENV_VARS.forEach((name) => {
    if (!env[name] || String(env[name]).trim() === '') {
      errors.push(`${name} is required`);
    }
  });

  if (!env.DATABASE_URL || String(env.DATABASE_URL).trim() === '') {
    REQUIRED_IF_NO_DATABASE_URL.forEach((name) => {
      if (!env[name] || String(env[name]).trim() === '') {
        errors.push(`${name} is required when DATABASE_URL is not set`);
      }
    });
  }

  if (env.PORT && !isPositiveInteger(String(env.PORT))) {
    errors.push('PORT must be a positive integer');
  }

  if (env.DB_PORT && !isPositiveInteger(String(env.DB_PORT))) {
    errors.push('DB_PORT must be a positive integer');
  }

  if (env.STELLAR_NETWORK && !isValidStellarNetwork(env.STELLAR_NETWORK)) {
    errors.push('STELLAR_NETWORK must be one of: testnet, public, mainnet, futurenet, sandbox, standalone');
  }

  return errors;
};

const validateStartupConfig = (env = process.env) => {
  const errors = collectValidationErrors(env);

  if (errors.length > 0) {
    const formatted = errors.map((entry) => `- ${entry}`).join('\n');
    throw new Error(`Invalid startup configuration:\n${formatted}`);
  }
};

module.exports = {
  validateStartupConfig,
  collectValidationErrors,
};
