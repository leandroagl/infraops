import { formatOdooTicketId } from './odoo';

describe('formatOdooTicketId()', () => {
  it('pads 1 to #00001', () => {
    expect(formatOdooTicketId(1)).toBe('#00001');
  });

  it('pads 137 to #00137', () => {
    expect(formatOdooTicketId(137)).toBe('#00137');
  });

  it('formats 5137 as #05137', () => {
    expect(formatOdooTicketId(5137)).toBe('#05137');
  });

  it('no trunca números de más de 5 dígitos', () => {
    expect(formatOdooTicketId(123456)).toBe('#123456');
  });
});
