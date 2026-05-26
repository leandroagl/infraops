import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '../task-status.enum';

export class FilterTasksDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;
}