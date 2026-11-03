import { IsOptional, IsString } from 'class-validator';

export class PatchUnifiLocalIntegrationConfigDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() apiKey?: string;
}

export class UnifiLocalIntegrationConfigResponseDto {
  url: string;
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
