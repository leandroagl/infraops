import { IsEnum } from 'class-validator';
import { MaintenanceDeviationStatus } from '../maintenance-deviation-status.enum';

export class UpdateDeviationStatusDto {
  @IsEnum(MaintenanceDeviationStatus)
  status: MaintenanceDeviationStatus;
}
