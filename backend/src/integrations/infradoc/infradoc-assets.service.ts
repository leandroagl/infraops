import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

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
  asset_uri: string | null;
  asset_uri_2: string | null;
}

@Injectable()
export class InfradocAssetsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  async getAssets(infradocClientId: number): Promise<RawInfradocAsset[]> {
    const { url: baseUrl, apiKey } = await this.integrationConfigService.getInfraDocConfigDecrypted();
    if (!baseUrl || !apiKey) {
      throw new Error('URL y API key de InfraDoc no configuradas');
    }
    const url = `${baseUrl}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: apiKey, client_id: infradocClientId, limit: 500 },
      }),
    );

    if (response.data.success !== 'True') {
      const msg: string = response.data.message ?? '';
      if (msg.includes('No resource')) return [];
      throw new ServiceUnavailableException(`InfraDoc API error: ${msg}`);
    }

    const data = response.data.data;
    if (!Array.isArray(data)) return [];
    return data as RawInfradocAsset[];
  }

  async getAssetInterfaces(assetId: number): Promise<RawInfradocAsset[]> {
    const { url: baseUrl, apiKey } = await this.integrationConfigService.getInfraDocConfigDecrypted();
    if (!baseUrl || !apiKey) {
      throw new Error('URL y API key de InfraDoc no configuradas');
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
