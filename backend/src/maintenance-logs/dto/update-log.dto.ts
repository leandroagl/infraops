import { IsObject, IsOptional, IsString } from 'class-validator';
import type { MaintenancePayload } from '../log-item.interface';

export class UpdateLogDto {
  @IsOptional()
  @IsObject()
  payload?: MaintenancePayload;

  @IsOptional()
  @IsString()
  notes?: string;
}
