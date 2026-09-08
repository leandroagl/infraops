export interface Client {
  id: string;
  name: string;
  primaryAddress: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ClientSubscriptionHours {
  clientId: string;
  contracted: number;
  delivered: number;
  available: number;
}

export interface ClientWithHours extends Client {
  hours?: ClientSubscriptionHours;
}

/** Calidad de consumo: mayor consumo = mejor. Distinto de la zona de filtrado. */
export type HoursBarState = 'ok' | 'warn' | 'crit';

export function hoursBarState(pct: number): HoursBarState {
  if (pct > 100) return 'warn';   // excedente
  if (pct >= 50)  return 'ok';    // buen consumo
  if (pct >= 15)  return 'warn';  // consumo bajo
  return 'crit';                   // consumo crítico (<15%)
}
