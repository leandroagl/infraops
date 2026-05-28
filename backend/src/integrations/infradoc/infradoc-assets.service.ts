import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface RawInfradocAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_ip: string | null;
  asset_os: string | null;
  asset_model: string | null;
}

@Injectable()
export class InfradocAssetsService {
  constructor(private readonly httpService: HttpService) {}

  async getAssets(infradocClientId: number): Promise<RawInfradocAsset[]> {
    const url = `${process.env.INFRADOC_URL}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: {
          api_key: process.env.INFRADOC_API_KEY,
          client_id: infradocClientId,
          limit: 500,
        },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    return response.data.data as RawInfradocAsset[];
  }
}
