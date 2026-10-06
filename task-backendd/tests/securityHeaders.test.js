const request = require('supertest');
const { app } = require('../server');
const { generateOAuthState, verifyOAuthState } = require('../routes/github');

describe('Phase 3-B: Security Headers & OAuth Fallback Removal Tests (P1-2 & P1-3)', () => {
  describe('Helmet CSP & Security Response Headers', () => {
    it('includes Content-Security-Policy header with expected directives', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('includes standard Helmet defense-in-depth security headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('OAuth Fallback Secret Removal (P1-3)', () => {
    const originalSecret = process.env.GITHUB_CLIENT_SECRET;
    const originalJwtSecret = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.GITHUB_CLIENT_SECRET = originalSecret;
      process.env.JWT_SECRET = originalJwtSecret;
    });

    it('throws explicit error when attempting state generation without server secret', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => generateOAuthState('user123')).toThrow(/Server secret configuration missing/);
    });

    it('returns false when attempting state verification without server secret', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.JWT_SECRET;

      const isValid = verifyOAuthState('user123:12345:nonce:sig', 'user123');
      expect(isValid).toBe(false);
    });

    it('successfully generates and verifies OAuth state when JWT_SECRET is configured', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      process.env.JWT_SECRET = 'configured_jwt_secret_1234567890123';

      const state = generateOAuthState('user123');
      expect(state).toBeDefined();
      expect(state.split(':').length).toBe(4);

      const isValid = verifyOAuthState(state, 'user123');
      expect(isValid).toBe(true);
    });
  });
});
