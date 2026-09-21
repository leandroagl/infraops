import { TIME_PATTERN, minutesToTime, timeToMinutes } from './time-format';

describe('time-format', () => {
  describe('timeToMinutes', () => {
    it('convierte HH:MM a minutos totales', () => {
      expect(timeToMinutes('01:30')).toBe(90);
      expect(timeToMinutes('00:45')).toBe(45);
      expect(timeToMinutes('02:00')).toBe(120);
    });
  });

  describe('minutesToTime', () => {
    it('convierte minutos totales a HH:MM con ceros a la izquierda', () => {
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(45)).toBe('00:45');
      expect(minutesToTime(120)).toBe('02:00');
    });
  });

  describe('TIME_PATTERN', () => {
    it('matchea formatos HH:MM válidos', () => {
      expect(TIME_PATTERN.test('9:05')).toBe(true);
      expect(TIME_PATTERN.test('23:59')).toBe(true);
      expect(TIME_PATTERN.test('01:30')).toBe(true);
    });

    it('no matchea formatos inválidos', () => {
      expect(TIME_PATTERN.test('abc')).toBe(false);
      expect(TIME_PATTERN.test('0805')).toBe(false);
      expect(TIME_PATTERN.test('')).toBe(false);
    });
  });
});
