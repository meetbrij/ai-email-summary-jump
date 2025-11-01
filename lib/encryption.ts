import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get the encryption key from environment variable
 * Ensures the key is properly formatted
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Convert base64 key to buffer
  return Buffer.from(key, 'base64');
}

/**
 * Encrypt a string value
 * @param text - The plain text to encrypt
 * @returns Encrypted string in base64 format
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);

    // Return as base64
    return combined.toString('base64');
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - The encrypted string in base64 format
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Convert from base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = combined.subarray(ENCRYPTED_POSITION);

    // Derive key using same parameters
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a secure encryption key
 * @returns Base64 encoded encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
