const validateEnv = require('../config/validateEnv');

describe('Phase 3-B: Production Environment Validation Tests (P1-1)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes validation in test environment with safe defaults', () => {
    process.env.NODE_ENV = 'test';
    const result = validateEnv();
    expect(result.valid).toBe(true);
  });

  it('validates JWT_SECRET minimum 32 characters in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short_secret';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(() => validateEnv()).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('validates GITHUB_TOKEN_ENCRYPTION_KEY byte length strictly', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a_very_long_production_jwt_secret_key_12345';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'invalid_key_length';

    expect(() => validateEnv()).toThrow(/GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes/);
  });

  it('passes validation with strong production configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a_very_long_production_jwt_secret_key_123456789';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.CLIENT_ORIGIN = 'https://app.taskmgmt.com';

    const result = validateEnv();
    expect(result.valid).toBe(true);
  });
});
