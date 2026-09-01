import { IsString, IsOptional } from 'class-validator';

export class PatchInfraDocConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class InfraDocConfigResponseDto {
  url: string;
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
