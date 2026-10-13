import { IsString, IsOptional } from 'class-validator';

export class PatchVeeamIntegrationConfigDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class VeeamIntegrationConfigResponseDto {
  username: string;
  password: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
