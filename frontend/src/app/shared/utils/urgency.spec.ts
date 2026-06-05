import { daysFromToday, urgencyLabel, urgencyClass } from './urgency';

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
    it('days < 0 → "+Nd vencido"', () => {
      expect(urgencyLabel(-3)).toBe('+3d vencido');
    });

    it('days === 0 → "vence en 0d"', () => {
      expect(urgencyLabel(0)).toBe('vence en 0d');
    });

    it('days === 7 → "vence en 7d"', () => {
      expect(urgencyLabel(7)).toBe('vence en 7d');
    });

    it('days > 7 → "Nd restantes"', () => {
      expect(urgencyLabel(15)).toBe('15d restantes');
    });
  });

  describe('urgencyClass()', () => {
    it('days < 0 → "urg-crit"', () => {
      expect(urgencyClass(-1)).toBe('urg-crit');
    });

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

});
