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
