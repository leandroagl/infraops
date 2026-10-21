import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUnifiSiteConfigDto {
  @IsUUID()
  clientId: string;

  @IsString()
  clientName: string;

  @IsString()
  siteId: string;

  @IsString()
  siteName: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateUnifiSiteConfigDto {
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UnifiSiteConfigResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled: boolean;
  createdAt: Date;
}
