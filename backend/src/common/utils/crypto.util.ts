import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function encrypt(plain: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const colonIdx = stored.indexOf(':');
  if (colonIdx === -1) throw new Error('Formato de credencial cifrada inválido');
  const ivHex  = stored.slice(0, colonIdx);
  const encHex = stored.slice(colonIdx + 1);
  const key    = Buffer.from(keyHex, 'hex');
  const iv     = Buffer.from(ivHex, 'hex');
  const encBuf = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}
