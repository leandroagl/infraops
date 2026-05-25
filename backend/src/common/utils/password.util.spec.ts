import { generateRandomPassword } from './password.util';

describe('generateRandomPassword', () => {
  it('generates a password of exactly 12 characters', () => {
    expect(generateRandomPassword()).toHaveLength(12);
  });

  it('contains at least one uppercase letter', () => {
    expect(/[A-Z]/.test(generateRandomPassword())).toBe(true);
  });

  it('contains at least one number', () => {
    expect(/[0-9]/.test(generateRandomPassword())).toBe(true);
  });

  it('contains at least one special character', () => {
    expect(/[!@#$%^&*()\-_=+]/.test(generateRandomPassword())).toBe(true);
  });

  it('generates different passwords on consecutive calls', () => {
    const p1 = generateRandomPassword();
    const p2 = generateRandomPassword();
    expect(p1).not.toBe(p2);
  });

  it('contains at least one lowercase letter', () => {
    expect(/[a-z]/.test(generateRandomPassword())).toBe(true);
  });

  it('only contains characters from the allowed set', () => {
    const allowed = /^[A-Za-z0-9!@#$%^&*()\-_=+]+$/;
    for (let i = 0; i < 50; i++) {
      expect(allowed.test(generateRandomPassword())).toBe(true);
    }
  });
});
