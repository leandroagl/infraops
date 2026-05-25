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

@Injectable()
export class InfradocService {
  constructor(private readonly httpService: HttpService) {}

  async getClients(): Promise<InfradocClient[]> {
    const url = `${process.env.INFRADOC_URL}/api/v1/clients/read.php`;
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

    return (response.data.data as Record<string, unknown>[]).map(this.mapClient);
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
      taxIdNumber: (raw.client_tax_id_number as string) ?? null,
      isLead: raw.client_is_lead === 1 || raw.client_is_lead === '1',
      notes: (raw.client_notes as string) ?? null,
      isActive:
        raw.client_archived_at === null ||
        raw.client_archived_at === undefined,
    };
  }
}