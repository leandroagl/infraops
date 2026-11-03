import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class BulkSiteItemDto {
  @IsString()
  siteId: string;

  @IsString()
  siteName: string;
}

export class CreateUnifiSiteConfigsBulkDto {
  @IsUUID()
  clientId: string;

  @IsString()
  clientName: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSiteItemDto)
  sites: BulkSiteItemDto[];
}

export class AvailableUnifiSiteDto {
  siteId: string;
  siteName: string;
}
