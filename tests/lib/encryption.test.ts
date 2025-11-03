import { encrypt, decrypt, generateEncryptionKey } from '@/lib/encryption';

describe('Encryption Module', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Ensure we have a valid encryption key for tests
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long-for-testing-purposes';
  });

  afterEach(() => {
    // Restore original environment
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe('encrypt()', () => {
    it('should encrypt a simple string', () => {
      const plainText = 'Hello, World!';
      const encrypted = encrypt(plainText);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plainText);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertexts for the same input (unique salt/IV)', () => {
      const plainText = 'Same input text';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt long strings', () => {
      const longText = 'A'.repeat(10000);
      const encrypted = encrypt(longText);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt strings with special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = encrypt(specialText);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt unicode characters', () => {
      const unicodeText = '你好世界 🌍 Привет мир';
      const encrypted = encrypt(unicodeText);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });
  });

  describe('decrypt()', () => {
    it('should decrypt a simple encrypted string', () => {
      const plainText = 'Hello, World!';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt empty string', () => {
      const plainText = '';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt long strings', () => {
      const longText = 'B'.repeat(10000);
      const encrypted = encrypt(longText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('should decrypt strings with special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = encrypt(specialText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should decrypt unicode characters', () => {
      const unicodeText = '你好世界 🌍 Привет мир';
      const encrypted = encrypt(unicodeText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      const encrypted = encrypt('test');
      delete process.env.ENCRYPTION_KEY;

      expect(() => decrypt(encrypted)).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error when encrypted data is invalid base64', () => {
      expect(() => decrypt('invalid-base64-!!!')).toThrow('Decryption failed');
    });

    it('should throw error when encrypted data is too short', () => {
      const shortData = Buffer.from('short').toString('base64');

      expect(() => decrypt(shortData)).toThrow('Decryption failed');
    });

    it('should throw error when encrypted data is tampered (modified ciphertext)', () => {
      const plainText = 'Secret message';
      const encrypted = encrypt(plainText);

      // Tamper with the encrypted data
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xFF; // Flip bits
      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should throw error when auth tag is modified', () => {
      const plainText = 'Secret message';
      const encrypted = encrypt(plainText);

      // Tamper with the auth tag (bytes 64-80)
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[70] = buffer[70] ^ 0xFF; // Flip bits in auth tag
      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should throw error when decrypting with different encryption key', () => {
      const plainText = 'Secret message';
      const encrypted = encrypt(plainText);

      // Change encryption key
      process.env.ENCRYPTION_KEY = 'different-key-32-chars-long-for-testing-purposes-x';

      expect(() => decrypt(encrypted)).toThrow('Decryption failed');
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should handle multiple round-trips', () => {
      const plainText = 'Multiple round-trip test';

      // First round-trip
      const encrypted1 = encrypt(plainText);
      const decrypted1 = decrypt(encrypted1);
      expect(decrypted1).toBe(plainText);

      // Second round-trip
      const encrypted2 = encrypt(decrypted1);
      const decrypted2 = decrypt(encrypted2);
      expect(decrypted2).toBe(plainText);

      // Third round-trip
      const encrypted3 = encrypt(decrypted2);
      const decrypted3 = decrypt(encrypted3);
      expect(decrypted3).toBe(plainText);
    });

    it('should handle OAuth refresh token format', () => {
      const refreshToken = '1//0gAbCdEfGhIjKlMnOpQrStUvWxYz-L5n6m7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0';
      const encrypted = encrypt(refreshToken);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(refreshToken);
    });

    it('should handle JSON strings', () => {
      const jsonData = JSON.stringify({
        access_token: 'ya29.a0AfH6SMBx...',
        refresh_token: '1//0gAbCdEf...',
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        token_type: 'Bearer',
        expiry_date: 1234567890000,
      });

      const encrypted = encrypt(jsonData);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });

  describe('generateEncryptionKey()', () => {
    it('should generate a base64 string', () => {
      const key = generateEncryptionKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const key3 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should generate a valid base64 key', () => {
      const key = generateEncryptionKey();

      // Should be valid base64
      expect(() => Buffer.from(key, 'base64')).not.toThrow();

      // Should decode to 32 bytes
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);
    });

    it('should generate a key that can be used for encryption', () => {
      const key = generateEncryptionKey();

      // Set as environment variable
      process.env.ENCRYPTION_KEY = key;

      const plainText = 'Test with generated key';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should generate cryptographically random keys (statistical test)', () => {
      const keys = Array.from({ length: 10 }, () => generateEncryptionKey());

      // Check that all keys are unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);

      // Check that keys have good entropy (no repeated characters in first 10 chars)
      keys.forEach((key) => {
        const first10 = key.substring(0, 10);
        const uniqueChars = new Set(first10.split(''));
        // Should have at least 7 unique characters in first 10
        expect(uniqueChars.size).toBeGreaterThanOrEqual(7);
      });
    });
  });

  describe('Security properties', () => {
    it('should use PBKDF2 for key derivation (implicit test)', () => {
      // This is tested implicitly through the encryption/decryption process
      // PBKDF2 is used with 100,000 iterations as specified in the code
      const plainText = 'PBKDF2 key derivation test';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should use authenticated encryption (GCM mode)', () => {
      // GCM mode provides authentication
      // Tampering should be detected (tested in decrypt tests)
      const plainText = 'Authenticated encryption test';
      const encrypted = encrypt(plainText);

      // Tamper with ciphertext
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0x01;
      const tampered = buffer.toString('base64');

      // Should fail due to authentication check
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should use unique salt for each encryption', () => {
      const plainText = 'Salt uniqueness test';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);

      // Extract salts (first 64 bytes)
      const buffer1 = Buffer.from(encrypted1, 'base64');
      const buffer2 = Buffer.from(encrypted2, 'base64');

      const salt1 = buffer1.subarray(0, 64);
      const salt2 = buffer2.subarray(0, 64);

      expect(salt1.equals(salt2)).toBe(false);
    });

    it('should use unique IV for each encryption', () => {
      const plainText = 'IV uniqueness test';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);

      // Extract IVs (bytes 64-80)
      const buffer1 = Buffer.from(encrypted1, 'base64');
      const buffer2 = Buffer.from(encrypted2, 'base64');

      const iv1 = buffer1.subarray(64, 80);
      const iv2 = buffer2.subarray(64, 80);

      expect(iv1.equals(iv2)).toBe(false);
    });
  });
});
