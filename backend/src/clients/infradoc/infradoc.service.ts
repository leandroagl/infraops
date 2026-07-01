import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface InfradocClient {
  infradocId: number;
  name: string;
  abbreviation: string | null;
  type: string | null;
  website: string | null;
  referral: string | null;
  rate: number | null;
  currencyCode: string | null;
  netTerms: number | null;
  taxIdNumber: string | null;
  isLead: boolean;
  notes: string | null;
  isActive: boolean;
}

export interface InfradocLocation {
  infradocClientId: number;
  address: string | null;
  city: string | null;
  isPrimary: boolean;
}

@Injectable()
export class InfradocService {
  constructor(private readonly httpService: HttpService) {}

  async getClients(): Promise<InfradocClient[]> {
    const url = `${process.env.INFRADOC_URL}/api/v1/clients/read.php`;
    // limit: 200 asume que ONDRA no superará ese número de clientes. Si lo hace, la sync truncará silenciosamente.
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: process.env.INFRADOC_API_KEY, limit: 200 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    return (response.data.data as Record<string, unknown>[]).map((raw) =>
      this.mapClient(raw),
    );
  }

  async getLocations(): Promise<InfradocLocation[]> {
    const url = `${process.env.INFRADOC_URL}/api/v1/locations/read.php`;
    // limit: 200 asume que ONDRA no superará ese número de locations. Si lo hace, la sync truncará silenciosamente.
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: process.env.INFRADOC_API_KEY, limit: 200 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    return (response.data.data as Record<string, unknown>[]).map((raw) =>
      this.mapLocation(raw),
    );
  }

  private extractCuit(value: string | null | undefined): string | null {
    if (!value) return null;
    return /^\d{2}-\d{8}-\d$/.test(value) ? value : null;
  }

  private mapLocation(raw: Record<string, unknown>): InfradocLocation {
    return {
      infradocClientId: Number(raw.location_client_id),
      address: (raw.location_address as string) ?? null,
      city: (raw.location_city as string) ?? null,
      isPrimary: raw.location_primary === '1' || raw.location_primary === 1,
    };
  }

  private mapClient(raw: Record<string, unknown>): InfradocClient {
    return {
      infradocId: Number(raw.client_id),
      name: raw.client_name as string,
      abbreviation: (raw.client_abbreviation as string) ?? null,
      type: (raw.client_type as string) ?? null,
      website: (raw.client_website as string) ?? null,
      referral: (raw.client_referral as string) ?? null,
      rate: raw.client_rate ? Number(raw.client_rate) : null,
      currencyCode: (raw.client_currency_code as string) ?? null,
      netTerms: raw.client_net_terms ? Number(raw.client_net_terms) : null,
      taxIdNumber: this.extractCuit(
        raw.client_industry as string | null | undefined,
      ),
      isLead: raw.client_is_lead === 1 || raw.client_is_lead === '1',
      notes: (raw.client_notes as string) ?? null,
      isActive:
        raw.client_archived_at === null || raw.client_archived_at === undefined,
    };
  }
}
