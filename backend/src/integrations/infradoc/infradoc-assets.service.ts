import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface RawInfradocAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_make: string | null;
  asset_os: string | null;
  asset_model: string | null;
  asset_description: string | null;
  interface_ip: string | null;
  interface_name: string | null;
  uri1: string | null;
  uri2: string | null;
}

@Injectable()
export class InfradocAssetsService {
  constructor(private readonly httpService: HttpService) {}

  async getAssets(infradocClientId: number): Promise<RawInfradocAsset[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
      );
    }
    const url = `${baseUrl}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: apiKey, client_id: infradocClientId, limit: 500 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    const data = response.data.data;
    if (!Array.isArray(data)) return [];
    return data as RawInfradocAsset[];
  }

  async getAssetInterfaces(assetId: number): Promise<RawInfradocAsset[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
      );
    }
    const url = `${baseUrl}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: apiKey, asset_id: assetId, limit: 500 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    const data = response.data.data;
    if (!Array.isArray(data)) return [];
    return data as RawInfradocAsset[];
  }
}
