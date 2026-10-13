import { IsString, IsOptional } from 'class-validator';

export class PatchJetbackupIntegrationConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class JetbackupIntegrationConfigResponseDto {
  url: string;
  username: string;
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
