import {
  IsString, IsOptional, IsInt, Min, IsArray, IsBoolean, IsObject,
} from 'class-validator';

export class ExpirationTypeConfigEntryDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId: number | null;

  @IsInt()
  @Min(1)
  daysAhead: number;

  @IsArray()
  @IsInt({ each: true })
  tagIds: number[];

  @IsOptional()
  @IsString()
  taskName?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTimeMinutes?: number | null;

  @IsOptional()
  @IsString()
  ticketDescription?: string | null;

  @IsOptional()
  @IsString()
  timesheetDescription?: string | null;
}

export class PatchOdooConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  db?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expirationsHelpdeskTeamId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expirationsTicketDaysAhead?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  expirationsTagIds?: number[];

  @IsOptional()
  @IsString()
  stageInProgressName?: string;

  @IsOptional()
  @IsString()
  stageNotDoneName?: string;

  @IsOptional()
  @IsString()
  stageDoneName?: string;

  // Diccionario por ExpirationType (asset_warranty/certificate/domain/software), no un
  // objeto único — @ValidateNested + @Type no soportan validar cada valor de un Record,
  // terminan tratando el diccionario entero como una sola instancia. Se valida a mano
  // en IntegrationConfigService.patchOdoo().
  @IsOptional()
  @IsObject()
  expirationsTypeConfigs?: Record<string, ExpirationTypeConfigEntryDto>;
}

export class OdooConfigResponseDto {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  helpdeskTeamId: number;
  expirationsHelpdeskTeamId: number;
  expirationsTicketDaysAhead: number;
  expirationsTagIds: number[];
  expirationsTypeConfigs: Record<string, {
    enabled: boolean;
    helpdeskTeamId: number | null;
    daysAhead: number;
    tagIds: number[];
  }> | null;
  stageInProgressName: string;
  stageNotDoneName: string;
  stageDoneName: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
