import crypto from 'crypto';

function getKey(): Buffer {
  const hex = process.env.CHANNEL_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('CHANNEL_ENCRYPTION_KEY environment variable is required');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('CHANNEL_ENCRYPTION_KEY must be a 32-byte (64 hex character) key');
  }
  return key;
}

// AES-256-GCM: random IV per encryption, auth tag appended for integrity. Output format:
// "<iv-hex>:<authTag-hex>:<ciphertext-hex>", safe to store as a plain string in the DB.
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
