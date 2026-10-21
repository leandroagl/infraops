// Respuesta cruda de api.ui.com
export interface UnifiApiSite {
  id: string;
  meta: { name: string; desc?: string };
}

export interface UnifiApiAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | string;
  payload?: { message?: string; [key: string]: unknown };
  siteId: string;
  closedAt: string | null;
  createdAt: string;
}

export interface UnifiApiListResponse<T> {
  data: T[];
  nextPage?: string;
}

// DTO normalizado que devuelve UnifiService
export interface UnifiAlert {
  alertId: string;
  siteId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  createdAt: string;
}
