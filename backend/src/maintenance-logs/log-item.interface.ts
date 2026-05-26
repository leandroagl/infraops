export interface LogItem {
  item: string;
  result: 'ok' | 'warn' | 'error';
  notes?: string;
}