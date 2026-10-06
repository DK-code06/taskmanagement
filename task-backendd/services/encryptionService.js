const crypto = require('crypto');

/**
 * Parses and validates the 32-byte (256-bit) AES encryption key.
 * Accepts a Buffer or a string (32-char utf8 or 64-char hex).
 */
function getEncryptionKey(overrideKey) {
  const rawKey = overrideKey !== undefined ? overrideKey : process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is required');
  }

  let keyBuffer;
  if (Buffer.isBuffer(rawKey)) {
    keyBuffer = rawKey;
  } else if (typeof rawKey === 'string') {
    if (rawKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(rawKey)) {
      keyBuffer = Buffer.from(rawKey, 'hex');
    } else {
      keyBuffer = Buffer.from(rawKey, 'utf8');
    }
  }

  if (!keyBuffer || keyBuffer.length !== 32) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits)');
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * Output format: `iv:authTag:encryptedData` (hex encoded).
 */
function encryptToken(plaintextToken, customKey) {
  if (!plaintextToken || typeof plaintextToken !== 'string') {
    throw new Error('Plaintext token must be a non-empty string');
  }

  const keyBuffer = getEncryptionKey(customKey);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(plaintextToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token string formatted as `iv:authTag:encryptedData`.
 * Returns the decrypted plaintext token string.
 */
function decryptToken(ciphertext, customKey) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Ciphertext must be a non-empty string');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected iv:authTag:encryptedData');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext component values');
  }

  const keyBuffer = getEncryptionKey(customKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: Token is invalid or corrupted (${err.message})`);
  }
}

module.exports = {
  encryptToken,
  decryptToken,
  getEncryptionKey
};
