const { encryptToken, decryptToken, getEncryptionKey } = require('../services/encryptionService');

describe('AES-256-GCM Encryption Service Tests', () => {
  const validHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes
  const validUtf8Key = '12345678901234567890123456789012'; // 32 utf8 chars = 32 bytes

  beforeEach(() => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = validHexKey;
  });

  describe('Key Validation', () => {
    it('accepts a valid 64-character hex key (32 bytes)', () => {
      const keyBuffer = getEncryptionKey(validHexKey);
      expect(keyBuffer.length).toBe(32);
    });

    it('accepts a valid 32-character string key (32 bytes)', () => {
      const keyBuffer = getEncryptionKey(validUtf8Key);
      expect(keyBuffer.length).toBe(32);
    });

    it('throws an error if key is missing', () => {
      expect(() => getEncryptionKey('')).toThrow('GITHUB_TOKEN_ENCRYPTION_KEY is required');
    });

    it('throws an error if key length is not 32 bytes', () => {
      expect(() => getEncryptionKey('too_short_key')).toThrow(
        'GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits)'
      );
    });
  });

  describe('Encryption & Decryption Lifecycle', () => {
    it('encrypts a plaintext token into iv:authTag:encryptedData format', () => {
      const token = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encryptToken(token, validHexKey);

      expect(typeof encrypted).toBe('string');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0]).toMatch(/^[0-9a-fA-F]{24}$/); // 12-byte IV in hex
      expect(parts[1]).toMatch(/^[0-9a-fA-F]{32}$/); // 16-byte AuthTag in hex
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('decrypts an encrypted token back to exact original plaintext', () => {
      const token = 'gho_secret_access_token_val_999999';
      const encrypted = encryptToken(token, validHexKey);
      const decrypted = decryptToken(encrypted, validHexKey);

      expect(decrypted).toBe(token);
    });

    it('produces unique IVs and ciphertexts for identical plaintext inputs', () => {
      const token = 'gho_same_token';
      const encrypted1 = encryptToken(token, validHexKey);
      const encrypted2 = encryptToken(token, validHexKey);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptToken(encrypted1, validHexKey)).toBe(token);
      expect(decryptToken(encrypted2, validHexKey)).toBe(token);
    });
  });

  describe('Error Handling & Security Constraints', () => {
    it('throws an error when encrypting invalid plaintext inputs', () => {
      expect(() => encryptToken(null, validHexKey)).toThrow('Plaintext token must be a non-empty string');
      expect(() => encryptToken('', validHexKey)).toThrow('Plaintext token must be a non-empty string');
      expect(() => encryptToken(12345, validHexKey)).toThrow('Plaintext token must be a non-empty string');
    });

    it('throws an error when decrypting malformed ciphertext strings', () => {
      expect(() => decryptToken('invalid_ciphertext_no_colons', validHexKey)).toThrow(
        'Invalid ciphertext format. Expected iv:authTag:encryptedData'
      );
      expect(() => decryptToken('iv:authtag', validHexKey)).toThrow(
        'Invalid ciphertext format. Expected iv:authTag:encryptedData'
      );
    });

    it('fails decryption when authTag is tampered', () => {
      const token = 'gho_tamper_test';
      const encrypted = encryptToken(token, validHexKey);
      const parts = encrypted.split(':');

      // Mutate authTag
      parts[1] = '0'.repeat(32);
      const tampered = parts.join(':');

      expect(() => decryptToken(tampered, validHexKey)).toThrow(/Decryption failed/);
    });

    it('fails decryption when encrypted payload is tampered', () => {
      const token = 'gho_tamper_payload_test';
      const encrypted = encryptToken(token, validHexKey);
      const parts = encrypted.split(':');

      // Mutate ciphertext payload
      parts[2] = parts[2].substring(0, parts[2].length - 2) + '00';
      const tampered = parts.join(':');

      expect(() => decryptToken(tampered, validHexKey)).toThrow(/Decryption failed/);
    });
  });
});
