import { environment } from '../../../environments/environment';

export function formatOdooTicketId(id: number): string {
  return '#' + String(id).padStart(5, '0');
}

export function odooTicketUrl(id: number): string {
  return `${environment.odooTicketsUrl}/${id}`;
}
