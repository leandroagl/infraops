import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class VeeamClientConfigResponseDto {
  provider: 'VEEAM';
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export class CreateVeeamConfigDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  isEnabled: boolean;
}

export class UpdateVeeamConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  host?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class TestConnectionResultDto {
  success: boolean;
  message: string;
  jobCount?: number;
}
