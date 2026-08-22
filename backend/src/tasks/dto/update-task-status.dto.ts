import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { TaskStatus } from '../task-status.enum';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ValidateIf((o) => o.status === TaskStatus.DONE)
  @IsInt()
  @Min(1)
  timeSpentMinutes?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
