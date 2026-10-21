import { IsOptional, IsString } from 'class-validator';

export class PatchUnifiIntegrationConfigDto {
  @IsOptional() @IsString() apiKey?: string;
}

export class UnifiIntegrationConfigResponseDto {
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
