import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '../task-status.enum';
import { TaskType } from '../task-type.enum';

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

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
}