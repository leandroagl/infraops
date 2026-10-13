import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class AcronisPlanConfigResponseDto {
  provider: 'ACRONIS';
  id: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyName: string;
  tenantName: string;
  isEnabled: boolean;
}

export class AcronisPlanRefDto {
  @IsString()
  @IsNotEmpty()
  policyId: string;

  @IsString()
  @IsNotEmpty()
  policyName: string;

  @IsString()
  @IsOptional()
  tenantName?: string;
}

export class CreateAcronisConfigsDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsBoolean()
  isEnabled: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AcronisPlanRefDto)
  plans: AcronisPlanRefDto[];
}

export class UpdateAcronisConfigDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Plan disponible en Acronis, con indicación de si ya está asignado a algún cliente.
export class AvailableAcronisPlanDto {
  policyId: string;
  policyName: string;
  tenantName: string;
  resourceTypes: string[];
  resourceCount: number;
  configured: boolean;
  configuredClientName: string | null;
}

export class AvailableAcronisPlansDto {
  plans: AvailableAcronisPlanDto[];
  // true si el barrido de Acronis quedó truncado: pueden faltar planes sin corridas recientes.
  partial: boolean;
}
