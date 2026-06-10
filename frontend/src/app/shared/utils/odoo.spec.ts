import { formatOdooTicketId, odooTicketUrl } from './odoo';
import { environment } from '../../../environments/environment';

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

describe('odooTicketUrl()', () => {
  it('construye la URL usando environment.odooTicketsUrl', () => {
    expect(odooTicketUrl(5174)).toBe(`${environment.odooTicketsUrl}/5174`);
  });

  it('el resultado contiene el id como segmento final', () => {
    expect(odooTicketUrl(99)).toContain('/99');
  });
});
