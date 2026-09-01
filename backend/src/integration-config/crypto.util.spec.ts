import { encrypt, decrypt, isMasked, MASK } from './crypto.util';

const KEY = '8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2';

describe('crypto.util', () => {
  it('cifra y descifra correctamente', () => {
    const original = 'mi-api-key-secreta';
    const stored = encrypt(original, KEY);
    expect(stored).not.toBe(original);
    expect(decrypt(stored, KEY)).toBe(original);
  });

  it('produce ciphertexts distintos para el mismo input (IV aleatorio)', () => {
    const a = encrypt('misma', KEY);
    const b = encrypt('misma', KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, KEY)).toBe('misma');
    expect(decrypt(b, KEY)).toBe('misma');
  });

  it('isMasked: true para MASK, false para todo lo demás', () => {
    expect(isMasked(MASK)).toBe(true);
    expect(isMasked('')).toBe(false);
    expect(isMasked(null)).toBe(false);
    expect(isMasked('valor-real')).toBe(false);
  });
});
