import { IsString, IsOptional } from 'class-validator';

export class PatchAcronisIntegrationConfigDto {
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;
}

export class AcronisIntegrationConfigResponseDto {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
