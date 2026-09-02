import { daysFromToday, daysUntilCycleClose, urgencyLabel, urgencyClass } from './urgency';

/** Genera una fecha ISO YYYY-MM-DD como hora local, N días desde hoy. */
function localIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('urgency utils', () => {

  describe('daysFromToday()', () => {
    it('retorna negativo para una fecha pasada', () => {
      expect(daysFromToday(localIsoDate(-3))).toBe(-3);
    });

    it('retorna 0 para hoy', () => {
      expect(daysFromToday(localIsoDate(0))).toBe(0);
    });

    it('retorna positivo para una fecha futura', () => {
      expect(daysFromToday(localIsoDate(5))).toBe(5);
    });

    it('acepta formato con sufijo T (ignora la parte de hora)', () => {
      const iso = localIsoDate(10) + 'T12:00:00';
      expect(daysFromToday(iso)).toBe(10);
    });
  });

  describe('urgencyLabel()', () => {
    it('days === 0 → "cierra hoy"', () => {
      expect(urgencyLabel(0)).toBe('cierra hoy');
    });

    it('days === 7 → "cierra en 7d"', () => {
      expect(urgencyLabel(7)).toBe('cierra en 7d');
    });

    it('days > 7 → "Nd para el cierre"', () => {
      expect(urgencyLabel(15)).toBe('15d para el cierre');
    });
  });

  describe('urgencyClass()', () => {
    it('days === 0 → "urg-warn"', () => {
      expect(urgencyClass(0)).toBe('urg-warn');
    });

    it('days === 7 → "urg-warn"', () => {
      expect(urgencyClass(7)).toBe('urg-warn');
    });

    it('days > 7 → "urg-ok"', () => {
      expect(urgencyClass(8)).toBe('urg-ok');
    });
  });

  describe('daysUntilCycleClose()', () => {
    it('retorna los días restantes hasta el último día del mes actual', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      lastDay.setHours(0, 0, 0, 0);
      const expected = Math.round((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysUntilCycleClose()).toBe(expected);
    });

    it('nunca es negativo dentro del mes actual', () => {
      expect(daysUntilCycleClose()).toBeGreaterThanOrEqual(0);
    });
  });

});
