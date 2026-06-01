import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import type { MaintenancePayload } from '../log-item.interface';

export class CreateLogDto {
  @IsObject()
  @IsNotEmpty()
  payload: MaintenancePayload;

  @IsOptional()
  @IsString()
  notes?: string;
}
