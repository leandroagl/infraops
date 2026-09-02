import * as crypto from 'crypto';

export const MASK = '••••••••';
const ALGORITHM = 'aes-256-gcm';

export function isMasked(value: string | null | undefined): boolean {
  return value === MASK;
}

function keyBuffer(keyHex: string): Buffer {
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'INTEGRATIONS_ENCRYPT_KEY no está configurada o no tiene el formato esperado (64 caracteres hex / 32 bytes)',
    );
  }
  return Buffer.from(keyHex, 'hex');
}

export function encrypt(plaintext: string, keyHex: string): string {
  const key = keyBuffer(keyHex);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const key = keyBuffer(keyHex);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
