const dotenv = require('dotenv');

/**
 * Production Environment Variable & Secret Validator (Phase 3-B P1-1)
 * Validates critical environment configuration before backend server starts accepting traffic.
 * Throws explicit descriptive errors on missing or weak production secrets without logging raw secret values.
 */
function validateEnv() {
  dotenv.config();

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const errors = [];

  // 1. JWT_SECRET Validation
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (!isTest) {
      errors.push('JWT_SECRET environment variable is missing.');
    }
  } else if (isProduction && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long in production environment.');
  }

  // 2. GITHUB_TOKEN_ENCRYPTION_KEY Validation (Strict 32-byte check)
  const encryptionKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (encryptionKey) {
    const isHex = /^[0-9a-fA-F]{64}$/.test(encryptionKey);
    const is32Char = (typeof encryptionKey === 'string' && encryptionKey.length === 32);
    if (!isHex && !is32Char) {
      errors.push('GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters or 32 string characters).');
    }
  } else if (isProduction && (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_SECRET)) {
    errors.push('GITHUB_TOKEN_ENCRYPTION_KEY is required when GitHub integration is enabled.');
  }

  // 3. GITHUB_WEBHOOK_SECRET Validation
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (isProduction && (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_SECRET) && !webhookSecret) {
    errors.push('GITHUB_WEBHOOK_SECRET is required when GitHub integration is enabled in production.');
  }

  // 4. CLIENT_ORIGIN Validation
  let clientOrigin = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.trim() : '';
  if (clientOrigin && isProduction) {
    if (!/^https?:\/\//i.test(clientOrigin)) {
      clientOrigin = `https://${clientOrigin}`;
      process.env.CLIENT_ORIGIN = clientOrigin;
    }
    if (clientOrigin.includes('<') || clientOrigin.includes('>')) {
      errors.push('CLIENT_ORIGIN contains placeholder brackets. Please set it to your actual Vercel app URL (e.g. https://taskmanagement-frontend.vercel.app).');
    } else {
      try {
        new URL(clientOrigin);
      } catch (err) {
        errors.push('CLIENT_ORIGIN must be a valid HTTP or HTTPS URL (e.g. https://taskmanagement-frontend.vercel.app).');
      }
    }
  }

  if (errors.length > 0 && !isTest) {
    const errorMessage = `❌ Critical Production Configuration Error(s):\n - ${errors.join('\n - ')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return {
    valid: errors.length === 0,
    errors,
    environment: process.env.NODE_ENV || 'development'
  };
}

module.exports = validateEnv;
