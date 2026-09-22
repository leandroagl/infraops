export function formatOdooTicketId(id: number): string {
  return '#' + String(id).padStart(5, '0');
}
