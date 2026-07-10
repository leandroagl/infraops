import { encrypt, decrypt } from './crypto.util';

describe('crypto.util', () => {
  const KEY = 'a'.repeat(64); // 32 bytes en hex

  it('round-trip: decrypt(encrypt(x)) === x', () => {
    const plain = 'odoo-super-secret-api-key-12345';
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it('produce ciphertext distinto en cada llamada (IV aleatorio)', () => {
    const plain = 'mismo-valor';
    expect(encrypt(plain, KEY)).not.toBe(encrypt(plain, KEY));
  });

  it('lanza con key incorrecta', () => {
    const stored = encrypt('valor', KEY);
    expect(() => decrypt(stored, 'b'.repeat(64))).toThrow();
  });

  it('lanza con formato de stored incorrecto', () => {
    expect(() => decrypt('sin-dos-puntos', KEY)).toThrow();
  });
});
