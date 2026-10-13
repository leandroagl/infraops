import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class JetbackupJobConfigResponseDto {
  provider: 'JETBACKUP';
  id: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobName: string;
  isEnabled: boolean;
}

export class JetbackupJobRefDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsNotEmpty()
  jobName: string;
}

export class CreateJetbackupConfigsDto {
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
  @Type(() => JetbackupJobRefDto)
  jobs: JetbackupJobRefDto[];
}

export class UpdateJetbackupConfigDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Job disponible en el WHM, con indicación de si ya está asignado a algún cliente.
export class AvailableJetbackupJobDto {
  jobId: string;
  name: string;
  disabled: boolean;
  configured: boolean;
  configuredClientName: string | null;
}
