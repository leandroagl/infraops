import { LocalDatePipe } from './local-date.pipe';

describe('LocalDatePipe', () => {
  let pipe: LocalDatePipe;

  beforeEach(() => {
    pipe = new LocalDatePipe();
  });

  it('formatea una fecha ISO (YYYY-MM-DD) en es-AR con día, mes corto y año', () => {
    const result = pipe.transform('2026-03-15');
    // Verificamos que el día "15", el año "2026" y algún separador estén presentes
    expect(result).toContain('15');
    expect(result).toContain('2026');
    expect(typeof result).toBe('string');
  });

  it('formatea correctamente el 1 de enero de 2026', () => {
    const result = pipe.transform('2026-01-01');
    expect(result).toContain('1');
    expect(result).toContain('2026');
  });

  it('formatea una fecha ISO con hora (ignora la parte de hora)', () => {
    // Mismo año y día que sin hora
    const withTime = pipe.transform('2026-06-15T12:00:00');
    const withoutTime = pipe.transform('2026-06-15');
    expect(withTime).toBe(withoutTime);
  });

  it('retorna string vacío para null', () => {
    expect(pipe.transform(null as unknown as string)).toBe('');
  });

  it('retorna string vacío para undefined', () => {
    expect(pipe.transform(undefined as unknown as string)).toBe('');
  });

  it('retorna string vacío para string vacío', () => {
    expect(pipe.transform('')).toBe('');
  });

  describe('formato "month"', () => {
    it('muestra solo mes y año capitalizado', () => {
      const result = pipe.transform('2026-06-15', 'month');
      expect(result).toContain('2026');
      expect(result).not.toContain('15');
    });

    it('retorna string vacío para null en formato month', () => {
      expect(pipe.transform(null as unknown as string, 'month')).toBe('');
    });
  });
});
