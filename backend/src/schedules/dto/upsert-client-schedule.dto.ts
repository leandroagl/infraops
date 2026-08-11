import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ScheduleGroup } from '../schedule-group.enum';

export class UpsertClientScheduleDto {
  @IsEnum(ScheduleGroup)
  @IsOptional()
  scheduleGroup: ScheduleGroup | null;

  @IsUUID()
  @IsOptional()
  technicianId: string | null;
}
